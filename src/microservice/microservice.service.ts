import { INestMicroservice, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientProxy, ClientProxyFactory, MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import axios from 'axios';
import { catchError, lastValueFrom, throwError, timeout,of, defaultIfEmpty } from 'rxjs';

import * as utils from '../utils'
import { RabbitMqModule } from '../rabbit-mq/rabbit-mq.module';

const cloudChecks = [
  { name: 'AWS', url: 'http://169.254.169.254/latest/meta-data/' },
  { name: 'Azure', url: 'http://169.254.169.254/metadata/instance?api-version=2021-02-01', headers: { 'Metadata': 'true' } },
  { name: 'GCP', url: 'http://metadata.google.internal/computeMetadata/v1/', headers: { 'Metadata-Flavor': 'Google' } },
];

export class MicroserviceService {
  private static serverAddress: net.AddressInfo;
  private static rabbitMQApp;
  private static async getServiceURI(serviceName: string): Promise<{ host: string, port: number }> {
    const response = await axios.get(`${process.env["CONSUL_URL"]}/v1/catalog/service/${serviceName}`);
    const serviceInfo = response.data;

    if (serviceInfo.length > 0) {
      const service = serviceInfo[0];
      const address = service.ServiceAddress || service.Address;
      const port = service.ServicePort;
      return {
        host: address,
        port: port,
      };
    } else {
      throw new ServiceUnavailableException(`Service ${serviceName} not found in Consul catalog`);
    }
  }

  private static async detectCloudProvider(): Promise<string | false> {

    for (const { name, url, headers } of cloudChecks) {
      try {
        await axios.get(url, { headers, timeout: 1000 });
        return name;
      } catch {
        continue;
      }
    }

    return false;
  }

  private static async registerService() {
    const microServiceName = await utils.microServiceName();
    const serviceData = {
      ID: microServiceName,
      Name: microServiceName,
      Address: this.serverAddress.address,
      Port: this.serverAddress.port,
      Check: {
        TCP: this.host,
        Interval: "10s",
        Timeout: "5s",
        DeregisterCriticalServiceAfter: "1m"
      }
    };

    await axios.put(`${process.env["CONSUL_URL"]}/v1/agent/service/register`, serviceData);
    console.log(`Service registered with Consul on ${this.serverAddress.address}:${this.serverAddress.port}`);
  }

  private static async defineServerAddress(): Promise<net.AddressInfo> {
    if (await this.detectCloudProvider())
      return {
        address: `haku-sci-${await utils.microServiceName()}-${process.env.BRANCH}.${process.env.AWS_REGION}.elasticbeanstalk.com`,
        port: 3000
      } as net.AddressInfo
    // Create a new TCP serveur to get an available port
    const server = net.createServer();
    server.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address() as net.AddressInfo;
    address.address = 'localhost';
    address.family = 'IPv4';
    server.close();
    this.serverAddress=address;
  }

  private static async startMainMicroService(appModule): Promise<INestMicroservice> {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule,
      {
        transport: Transport.TCP,
        options: {
          port: this.serverAddress.port
        }
      },
    );
    await app.listen();
    return app;
  }

  private static async startRabbitMQMicroService(): Promise<INestMicroservice> {
    const queue = await utils.microServiceName();
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(RabbitMqModule, {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: queue,
        queueOptions: {
          durable: true,
        },
        noAck: false,
      },
    });
    await app.listen();
    return app;
  }

  static get host():string{
    return `${this.serverAddress.address}:${this.serverAddress.port}`
  }

  static async bootstrapMicroservice(appModule): Promise<INestMicroservice> {
    await this.defineServerAddress();

    // Initialize the database if needed
    if (process.env["RDS_DBNAME"]) {
      const postGresService = require('./postgres.service');
      postGresService.createDatabaseIfNotExists()
    }

    // Generate Microservice
    const app = await this.startMainMicroService(appModule);
    // Start rabbitmq
    if (process.env.RABBITMQ_URL)
      this.rabbitMQApp=await this.startRabbitMQMicroService();

    // Register service with consul
    if (process.env["CONSUL_URL"])
      this.registerService()
    return app
  }

  static async sendTCPMessage(service, messagePattern, payload?): Promise<any> {
    const client: ClientProxy = await ClientProxyFactory.create({
      transport: Transport.TCP,
      options: await MicroserviceService.getServiceURI(service),
    });
    try {
      let response$ = await client.send(messagePattern, payload).pipe(
        catchError(sendErr => throwError(() => new Error(sendErr)))
      );
      const watchdogTimeout = parseInt(process.env.WATCHDOG);
      if (!isNaN(watchdogTimeout) && watchdogTimeout > 0)
        response$ = response$.pipe(timeout({ first: watchdogTimeout }));
      response$ = response$.pipe(defaultIfEmpty(null));
      return await lastValueFrom(response$)
    }
    catch(e){
      if (e.message=="Error: Connection closed" && this.rabbitMQApp){
        await this.rabbitMQApp.close()
        await this.startRabbitMQMicroService()
      }    
      throw e
    }
    finally {
      try {
        await client.close();
      } catch (closeError) {
        console.error("Error closing client:", closeError.message);
      }
    }
  }
}