import { INestMicroservice, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import * as utils from '../utils'

import { AllExceptionsFilter } from './exceptionFilter';
import { Consul } from './consul';
import { TCPService } from '../TCP/tcp.service';

export class Microservice {
  private static serverAddress: net.AddressInfo = { family: 'IPv4', port: 3000, address: null };
  static logger: Logger;

  static async bootstrapMicroservice(appModule): Promise<void> {
    this.logger = new Logger(await utils.microServiceName())
    await this.setServerAddress();
    // Initialize the database if needed
    if (process.env.SQL_DB && process.env.DEBUG) {
      const postGresService = require('./postgres.service');
      postGresService.createDatabaseIfNotExists()
    }

    // Start Microservices
    const app = await this.startTCPMicroService(appModule);

    //Handle HakuSciMessagePattern
    await TCPService.registerHakuSciMessageHandlers(app, this.logger);

    // Register service with consul
    Consul.registerService(this.serverAddress, this.logger)
  }

  private static async setServerAddress(): Promise<void> {
    const { address, port } = await utils.resolveServerAddress(this.serverAddress.port, 'TCP_PORT', this.logger);
    this.serverAddress.address = address;
    this.serverAddress.port = port;
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