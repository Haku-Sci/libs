import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { catchError, lastValueFrom, throwError, timeout, defaultIfEmpty } from 'rxjs';
import * as utils from '../utils'
import { Consul } from './consul';

export class TCPService{
    static async sendMessage(service, action:string,resource?:string, payload?): Promise<any> {
        const client: ClientProxy = await ClientProxyFactory.create({
            transport: Transport.TCP,
            options: await Consul.getServiceURI(service),
        });
        try {
            payload.sender = await utils.microServiceName()
            let response$ = await client.send([resource,action].join("/"), payload).pipe(
                catchError(err => {const errorPayload = typeof err === 'object' ? err : { message: String(err) };
                return throwError(() => new Error(`[${service}] ${errorPayload.message}`));})
            );
            const watchdogTimeout = parseInt(process.env.WATCHDOG);
            if (!isNaN(watchdogTimeout) && watchdogTimeout > 0)
                response$ = response$.pipe(timeout({ first: watchdogTimeout }));
            response$ = response$.pipe(defaultIfEmpty(null));
            const result = await lastValueFrom(response$);
            if (result?.error)
                throw new Error(`[${service}] ${result.message}`);
            return result;
        }
        /*catch (e) {
            if(e.message.includes("There is no matching message handler defined in the remote service.")){
                this.sendTCPMessage(service, action,null, payload)
                return;
            }
            if (e.message == "Error: Connection closed" && this.rabbitMQApp) {
                await this.rabbitMQApp.close()
                await this.startRabbitMQMicroService()
            }
            throw e
        }*/
        finally {
            try {
                await client.close();
            } catch (closeError) {
                console.error("Error closing client:", closeError.message);
            }
        }
    }
}