import { INestMicroservice, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import * as utils from '../utils'

import { AllExceptionsFilter } from './exceptionFilter';
import * as os from 'os';
import { Consul } from './consul';
import { TCPService } from '../TCP/tcp.service';
import { HttpHealthAppModule } from '../minimal-app/http-health.module';

export class Microservice {
  private static serverAddress: net.AddressInfo = { family: 'IPv4', port: 3000, address: null };
  static logger: Logger;

  static async bootstrapMicroservice(appModule): Promise<void> {
    this.logger = new Logger(await utils.microServiceName())
    await this.setServerAddress();
    // Initialize the database if needed
    if (process.env[process.env.ENV_POSTGRESQL_DB] && process.env.DEBUG) {
      const postGresService = require('./postgres.service');
      postGresService.createDatabaseIfNotExists()
    }

    // Start Microservices
    if(process.env.CLOUD_PORT)
      await(await NestFactory.create(HttpHealthAppModule)).listen(process.env.CLOUD_PORT,'0.0.0.0') 
    const app = await this.startTCPMicroService(appModule);

    //Handle HakuSciMessagePattern
    await TCPService.registerHakuSciMessageHandlers(app, this.logger);

    // Register service with consul
    Consul.registerService(this.serverAddress, this.logger)
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
    this.serverAddress.address = process.env.ADDRESS || process.env.DEBUG && "127.0.0.1" || Object.values(os.networkInterfaces())
      .flatMap((iface) => iface ?? []) // filtre null/undefined
      .find((addr) => addr.family === 'IPv4' && !addr.internal)
      .address
    if(parseInt(process.env.PORT))
      this.serverAddress.port=parseInt(process.env.PORT);
    else
      while (!await this.isPortFree(this.serverAddress.port)) this.serverAddress.port++;
    this.logger.log("address to be listened to: "+this.serverAddress.address);
    this.logger.log("port to be listened to: "+this.serverAddress.port);
  }

  private static async startTCPMicroService(appModule): Promise<INestMicroservice> {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule,
      {
        transport: Transport.TCP,
        options: {
          port: this.serverAddress.port,
          host: this.serverAddress.address,
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