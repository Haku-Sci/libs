// libs/amqp-lib/src/amqp.service.ts
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import * as rabbitMQutils from './constants';
import * as utils from '../utils';
import axios from 'axios';

const rabbitMqApiAuth = {
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
};
@Injectable()
export class RabbitMqService {
    waitAckownledge: Record<string, { count: number, resolve: () => void, reject: () => void }> = {};
    amqpConnection: AmqpConnection;
    projectName: string;
    ackAttached: boolean = false;
    constructor() { 
        if(!process.env.RABBITMQ_URL)
            return 
        utils.microServiceName().then(projectName=>{
            this.projectName=projectName;
            this.amqpConnection = new AmqpConnection({
                exchanges: [
                    {
                        name: rabbitMQutils.HAKU_SCI_EXCHANGE,
                        type: 'topic',
                    }
                ],
                uri: process.env.RABBITMQ_URL,
            })
        })
    }

    private get ackQueueName() {
        return `${this.projectName}_${rabbitMQutils.ACK_QUEUE}`
    }

    async dispatchMessage(messagePattern: string, userId: string, id: string, payload: Record<string, any> = {}, requireAck: boolean = false): Promise<void> {
        const options = { headers: { userId: userId, id: id }, correlationId: null }
        let p: Promise<void>
        if (requireAck) {
            //Create the ack queue if not already created and start listening to it
            if (!this.ackAttached) {
                this.ackAttached = true;
                await this.amqpConnection.channel.assertQueue(this.ackQueueName, { durable: true });
                this.amqpConnection.channel.consume(this.ackQueueName, async (message) => {
                    const ackMessage = JSON.parse(message.content.toString())
                    this.updateAck(ackMessage.properties.correlationId);
                    this.amqpConnection.channel.ack(message);
                });
            }

            //Add the correlationId and the replyTo to the message's headers
            options.headers["replyTo"] = this.ackQueueName;
            options.correlationId = Date.now().toString();;
            //Get the number of expected ack
            const response = await axios.get(`${process.env.RABBITMQ_API_URL}/bindings`, { auth: rabbitMqApiAuth });
            let countExpectedAcknowledged = response.data.filter((binding: any) =>
                binding.source === rabbitMQutils.HAKU_SCI_EXCHANGE && binding.routing_key === messagePattern).length;

            p = new Promise<void>((resolve, reject) => {
                this.waitAckownledge[options.correlationId] = { count: countExpectedAcknowledged, resolve: resolve, reject: reject }
            })
            p = utils.withWatchdog(p, 10000);
        };
        await this.amqpConnection.publish(rabbitMQutils.HAKU_SCI_EXCHANGE, messagePattern, payload, options);
        return p;
    }

    sendAck(message: any) {
        this.amqpConnection.publish('', message.properties.headers.replyTo, message);
    }

    updateAck(correlationId: string) {
        if (this.waitAckownledge[correlationId]) {
            this.waitAckownledge[correlationId].count--;
            if (this.waitAckownledge[correlationId].count == 0) {
                this.waitAckownledge[correlationId].resolve();
                delete this.waitAckownledge[correlationId]
            }

        }

    }
}

export function HakuSubscribe(options: { routingKey: string }): MethodDecorator {
    return function (target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const message = args[1];
            try {
                await originalMethod.apply(this, args);
            } catch (error) {
                message.properties.headers["error"] = error;
            }
            finally {
                if (message.properties.headers.replyTo) {
                    try {
                        await this.moduleRef.get(RabbitMqService).sendAck(message);
                    } catch (e) { console.log(e) }
                };
            }
        }
        utils.microServiceName().then((projectName) => {
            RabbitSubscribe({
                routingKey: options.routingKey,
                exchange: rabbitMQutils.HAKU_SCI_EXCHANGE,
                queue: projectName,
            })(target, key, descriptor);
        });
    };
}
