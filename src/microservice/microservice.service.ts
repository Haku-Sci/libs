import { INestMicroservice, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import * as utils from '../utils'

import { AllExceptionsFilter } from './exceptionFilter';
import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import * as os from 'os';
import { Consul } from './consul';

export class Microservice {
  private static serverAddress: net.AddressInfo={family:'IPv4',port:3000,address:null};
  private static logger: Logger;

  static async bootstrapMicroservice(appModule):Promise<void> {
    this.setServerAddress();
    this.logger=new Logger(await utils.microServiceName())
    // Initialize the database if needed
    if (process.env["RDS_DBNAME"]) {
      const postGresService = require('./postgres.service');
      postGresService.createDatabaseIfNotExists()
    }

    // Start Microservice
    const app = await this.startMainMicroService(appModule);

    //Handle HakuSciMessagePattern
    await this.registerHakuSciMessageHandlers(app);

    // Register service with consul
    Consul.registerService(this.serverAddress,this.logger)
  }

  static async registerHakuSciMessageHandlers(app: any) {
    const moduleRef = app.select(DiscoveryModule);
    const discoveryService = moduleRef.get(DiscoveryService, { strict: false });
    
    const controllers = await discoveryService.controllers(()=>true);
    for (const { instance } of controllers) {
      const resource: string = Reflect.getMetadata(PATH_METADATA, instance.constructor).replace("/","");
      const prototype=Object.getPrototypeOf(instance);
      for (const propertyName of Object.getOwnPropertyNames(prototype)) {
        const method = prototype[propertyName];
        if (propertyName === 'constructor' || typeof method !== 'function') continue;
        const action = Reflect.getMetadata(PATTERN_METADATA, method)?.[0];
        if (action) {
          const handler = method.bind(instance);
          app.serverInstance.addHandler([resource,action].join("/"), handler, false);
        }
      }
    }
  } 

  private static isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        // Pour d'autres erreurs (ex: permission), on considère le port indisponible aussi
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, this.serverAddress.address); // Important : écoute sur toutes les interfaces
  });
  }

  private static async setServerAddress(): Promise<void> {
    this.serverAddress.address=Object.values(os.networkInterfaces())
      .flatMap((iface) => iface ?? []) // filtre null/undefined
      .find((addr) => addr.family === 'IPv4' && !addr.internal)
      .address
    while(!await this.isPortFree(this.serverAddress.port)) this.serverAddress.port++; 
  }

  private static async startMainMicroService(appModule): Promise<INestMicroservice> {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule,
      {
        transport: Transport.TCP,
        options: {
          port: this.serverAddress.port
        },
      },

    );
    app.useGlobalFilters(new AllExceptionsFilter(this.logger));  // Register global exception filter
    await app.listen();
    return app;
  }

  static get host(): string {
    return `${this.serverAddress.address}:${this.serverAddress.port}`
  }
}