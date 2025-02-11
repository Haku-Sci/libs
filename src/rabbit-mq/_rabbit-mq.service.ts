// libs/amqp-lib/src/amqp.service.ts
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import * as rabbitMQutils from './constants';
import * as utils from '../utils';
import axios from 'axios';

const rabbitMqApiAuth = {
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
};

export class RabbitMqService {
    static instance: RabbitMqService;
    waitAckownledge: Record<string, { count: number, responses: Record<string, any>, resolve: (data: Record<string, any>) => void, reject: (error: any) => void }> = {};
    amqpConnection: AmqpConnection;
    microServiceName: string;
    ackAttached: boolean = false;

    static async get(): Promise<RabbitMqService> {
        if (!this.instance) {
            this.instance = new RabbitMqService();
            await this.instance.init();
        }
        return this.instance;
    }

    private constructor() { }

    private async init() {
        this.microServiceName = await utils.microServiceName();
        this.amqpConnection = new AmqpConnection({
            exchanges: [
                {
                    name: rabbitMQutils.HAKU_SCI_EXCHANGE,
                    type: 'topic',
                }
            ],
            uri: process.env.RABBITMQ_URL,
        });

        await this.amqpConnection.init();
    }

    private get ackQueueName() {
        return `${this.microServiceName}_${rabbitMQutils.ACK_QUEUE}`;
    }

    async dispatchMessage(messagePattern: string, userId: string, id: string, payload: Record<string, any> = {}, requireAck: boolean = false): Promise<Record<string, any>> {
        const options = { headers: { userId: userId, id: id }, correlationId: null };
        let p: Promise<Record<string, any>>;

        if (requireAck) {
            if (!this.ackAttached) {
                this.ackAttached = true;
                await this.amqpConnection.channel.assertQueue(this.ackQueueName, { durable: true });
                this.amqpConnection.channel.consume(this.ackQueueName, async (message) => {
                    const ackMessage = JSON.parse(message.content.toString());
                    this.handleAckResponse(ackMessage);
                    this.amqpConnection.channel.ack(message);
                });
            }

            options.headers["replyTo"] = this.ackQueueName;
            options.correlationId = Date.now().toString();

            const response = await axios.get(`${process.env.RABBITMQ_API_URL}/bindings`, { auth: rabbitMqApiAuth });
            let countExpectedAcknowledged = response.data.filter((binding: any) =>
                binding.source === rabbitMQutils.HAKU_SCI_EXCHANGE && binding.routing_key === messagePattern).length;

            p = new Promise<Record<string, any>>((resolve, reject) => {
                this.waitAckownledge[options.correlationId] = { count: countExpectedAcknowledged, responses: {}, resolve, reject };
            });
        }

        await this.amqpConnection.publish(rabbitMQutils.HAKU_SCI_EXCHANGE, messagePattern, payload, options);
        return p || Promise.resolve({});
    }

    private handleAckResponse(ackMessage: any) {
        const { correlationId, microServiceName, response, error } = ackMessage;
        if (!this.waitAckownledge[correlationId]) return;
        if (error) {
            this.waitAckownledge[correlationId].reject(error);
            delete this.waitAckownledge[correlationId];
        }
        this.waitAckownledge[correlationId].responses[microServiceName] = response
        this.waitAckownledge[correlationId].count--;

        if (this.waitAckownledge[correlationId].count === 0) {
            this.waitAckownledge[correlationId].resolve(this.waitAckownledge[correlationId].responses);
            delete this.waitAckownledge[correlationId];
        }
    }

    sendAck(message: any) {
        this.amqpConnection.publish('', message.properties.headers.replyTo, message);
    }

}


export function HakuSubscribe(options: { routingKey: string }): MethodDecorator {
    return function (target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const message = args[1];
            try {
                message.response = await originalMethod.apply(this, args);
                message.properties.headers["microService"] = await utils.microServiceName()
            } catch (error) {
                message.properties.headers["error"] = error;
            }
            finally {
                if (message.properties.headers.replyTo) {
                    try {
                        await RabbitMqService.get().then((rabbitMqService) => {
                            rabbitMqService.sendAck(message);
                        });
                    } catch (e) { console.log(e) }
                };
            }
        }
        utils.microServiceName().then((microServiceName) => {
            RabbitSubscribe({
                routingKey: options.routingKey,
                exchange: rabbitMQutils.HAKU_SCI_EXCHANGE,
                queue: microServiceName,
            })(target, key, descriptor);
        });
    };
}

