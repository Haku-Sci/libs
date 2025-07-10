import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { catchError, lastValueFrom, throwError, timeout, defaultIfEmpty } from 'rxjs';
import * as utils from '../utils'
import { Consul } from '../microservice/consul';

import { ArgumentsHost, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../microservice/exceptionFilter';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';

@Injectable()
export class TCPService {
    static async sendMessage(service, action: string, resource?: string, payload={}): Promise<any> {
        const client: ClientProxy = await ClientProxyFactory.create({
            transport: Transport.TCP,
            options: await Consul.getServiceURI(service),
        });
        try {
            payload["sender"] = await utils.microServiceName()
            let response$ = await client.send([resource, action].join("/"), payload).pipe(
                catchError(err => {
                    const status = err?.status || HttpStatus.BAD_REQUEST;
                    const payload = {
                        ...(typeof err === 'object' ? err : { message: err }),
                        service, 
                    };
                    return throwError(
                        () => new HttpException(payload, status)
                    );
                })
            );
            const watchdogTimeout = parseInt(process.env.WATCHDOG);
            if (!isNaN(watchdogTimeout) && watchdogTimeout > 0)
                response$ = response$.pipe(timeout({ first: watchdogTimeout }));
            response$ = response$.pipe(defaultIfEmpty(null));
            const result = await lastValueFrom(response$);
            if (result?.error)
                throwError(() => new Error(`[${service}] ${result.message}`));
            return result;
        }
        finally {
            try {
                await client.close();
            } catch (closeError) {
                console.error("Error closing client:", closeError.message);
            }
        }
    }

    static async registerHakuSciMessageHandlers(app: any, logger: Logger) {
        const moduleRef = app.select(DiscoveryModule);
        const discoveryService = moduleRef.get(DiscoveryService, { strict: false });

        const controllers = await discoveryService.controllers(() => true);
        for (const { instance } of controllers) {
            const resource: string = Reflect.getMetadata(PATH_METADATA, instance.constructor).replace("/", "");
            const prototype = Object.getPrototypeOf(instance);
            for (const propertyName of Object.getOwnPropertyNames(prototype)) {
                const method = prototype[propertyName];
                if (propertyName === 'constructor' || typeof method !== 'function') continue;
                const action = Reflect.getMetadata(PATTERN_METADATA, method)?.[0];
                if (action) {

                    const handler = TCPService.wrapHandler(instance, propertyName, logger);
                    app.serverInstance.addHandler([resource, action].join("/"), handler, false);
                }
            }
        }
        logger.log("HakuSci Message Handlers initialized")
    }

    private static wrapHandler(
        instance: any,
        methodName: string,
        logger: Logger
    ): (...args: any[]) => any {
        return async function boundHandler(data: any, context: any) {
            try {
                // Appel de la méthode d’origine
                return await instance[methodName].call(instance, data);
            } catch (err) {
                // Reconstruction minimale d’un ArgumentsHost RPC
                const host: ArgumentsHost = {
                    switchToRpc: () => ({ getContext: () => context }),
                    getArgByIndex: (i: number) => (i === 0 ? data : context),
                    // les autres méthodes ne seront pas utilisées ici
                } as any;

                // Renvoi de l’Observable d’erreur produit par le filtre
                return new AllExceptionsFilter(logger).catch(err, host);
            }
        };
    }
}