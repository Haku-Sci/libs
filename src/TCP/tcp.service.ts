import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { TCP_PARAM_METADATA_KEY } from './tcp-param.decorator';
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
        let client: ClientProxy;
        try {
            client = await ClientProxyFactory.create({
                transport: Transport.TCP,
                options: await Consul.getServiceURI(service),
            });
        } catch (err: any) {
            const status = err?.status || err?.statusCode || HttpStatus.SERVICE_UNAVAILABLE;
            throw new HttpException(
                { message: err?.message || 'Unknown error', service },
                status
            );
        }
        try {
            payload["sender"] = await utils.microServiceName()
            let response$ = await client.send([resource, action].join("/"), payload).pipe(
                catchError(err => {
                    const inner = err?.error ?? err;
                    // No status/statusCode means the remote app never got to handle the request -
                    // the failure happened at the transport level (connection dropped, timed out),
                    // which is a service-availability problem, not a bad request from our side.
                    const status = inner?.status || inner?.statusCode || err?.status || HttpStatus.SERVICE_UNAVAILABLE;
                    const message =
                        (typeof inner === 'object' ? inner?.message : inner) ||
                        err?.message ||
                        'Unknown error';
                    const payload = {
                        ...(typeof inner === 'object' ? inner : {}),
                        message,
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
            if ((result as any)?.error)
                throwError(() => new Error(`[${service}] ${(result as any).message}`));
            return result;
        }
        finally {
            try {
                await client.close();
            } catch (closeError:any) {
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
        TCPService.enablePatternRouting(app.serverInstance);
        logger.log("HakuSci Message Handlers initialized")
    }

    private static enablePatternRouting(server: any) {
        const handlers: Map<string, any> = (server as any).messageHandlers;
        const paramPatterns: Array<{ regex: RegExp; paramNames: string[]; registeredKey: string }> = [];

        for (const key of handlers.keys()) {
            if (!key.includes(':')) continue;
            const paramNames: string[] = [];
            const regexStr = key.replace(/:([^/]+)/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            });
            paramPatterns.push({ regex: new RegExp(`^${regexStr}$`), paramNames, registeredKey: key });
        }

        if (paramPatterns.length === 0) return;

        const originalGetHandler = server.getHandlerByPattern.bind(server);
        server.getHandlerByPattern = (incomingPattern: string) => {
            const exact = originalGetHandler(incomingPattern);
            if (exact) return exact;

            for (const { regex, paramNames, registeredKey } of paramPatterns) {
                const match = incomingPattern.match(regex);
                if (!match) continue;
                const originalHandler = originalGetHandler(registeredKey);
                if (!originalHandler) continue;

                const params: Record<string, string> = {};
                paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
                return (data: any, ctx: any) => originalHandler({ ...data, params }, ctx);
            }
            return null;
        };
    }

    private static normalizeErrors(result: any): any {
        if (!result || typeof result !== 'object' || !('errors' in result)) return result;
        const errors = result.errors;
        if (!errors || Array.isArray(errors) || typeof errors !== 'object') return result;
        return {
            ...result,
            errors: Object.entries(errors).map(([id, error]) => ({
                id,
                message: error instanceof Error ? error.message : String(error),
            })),
        };
    }

    private static wrapHandler(
        instance: any,
        methodName: string,
        logger: Logger
    ): (...args: any[]) => any {
        const prototype = Object.getPrototypeOf(instance);
        const tcpParamMeta: Array<{ index: number; name: string }> =
            Reflect.getMetadata(TCP_PARAM_METADATA_KEY, prototype, methodName) ?? [];

        return async function boundHandler(data: any, context: any) {
            try {
                const { params, ...payload } = data ?? {};
                const args: any[] = [tcpParamMeta.length > 0 ? payload : data];
                for (const { index, name } of tcpParamMeta)
                    args[index] = params?.[name];
                const result = await instance[methodName].apply(instance, args);
                return TCPService.normalizeErrors(result);
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