import { INestApplication, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ClientProxy, ClientProxyFactory, MicroserviceOptions, NestMicroservice, Transport } from '@nestjs/microservices';
import * as net from 'net';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';

const HAKU_SCI_EXCHANGE = 'Haku-SciExchange';

@Injectable()
export class MicroserviceService {
  private static serviceAddress: net.AddressInfo;
  private static msName: string

  static async projectName(): Promise<string> {
    if (!this.msName) {
      var data = await readFile(
        path.join(
          process.cwd(),
          'package.json',
        )
      )
      const { name } = JSON.parse(data.toString());
      this.msName = name;
    }
    return this.msName;
  }

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
      throw new NotFoundException(`Service ${serviceName} not found in Consul catalog`);
    }
  }

  static async sendTCPMessage(service, messagePattern, payload?): Promise<any> {
    const client: ClientProxy = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: await MicroserviceService.getServiceURI(service),
    });
    try {
      const result = await lastValueFrom(await client.send(messagePattern, payload));
      return result;
    } finally {
      client.close();
    }
  }

  static async emitTCPEvent(messagePattern, queue?, payload?): Promise<void> {
    const client: ClientProxy = ClientProxyFactory.create({
      //transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env["RABBITMQ_URL"]}`],
        queue: queue, // La queue est créée mais pas nécessaire pour le producteur
        queueOptions: {
          durable: false,
        },
        exchange: HAKU_SCI_EXCHANGE,  // Nom de l'exchange fanout
      },
    });
    try {
      await client.emit(messagePattern, payload);
    } finally {
      client.close();
    }
  }

  private static async registerService(address: net.AddressInfo) {
    const projectName = await this.projectName();
    const serviceData = {
      ID: projectName,
      Name: projectName,
      Address: address.address,
      Port: address.port,
      Check: {
        TCP: `${address.address}:${address.port}`,
        Interval: "10s",
        Timeout: "5s",
        DeregisterCriticalServiceAfter: "1m"
      }
    };

    await axios.put(`${process.env["CONSUL_URL"]}/v1/agent/service/register`, serviceData);
    console.log(`Service registered with Consul on ${address.address}:${address.port}`);
  }

  static async bootstrapMicroservice(appModule): Promise<INestApplication> {
    // Create a new TCP serveur to get an available port
    const server = net.createServer();
    server.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    this.serviceAddress = server.address() as net.AddressInfo;

    //Generate Microservice
    const app = await NestFactory.create(appModule)
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.TCP,
        options: {
          port: this.serviceAddress.port
        }
      },
    );

    // 2. Démarrer le transport RabbitMQ
    if (process.env["RABBITMQ_URL"]) {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
          urls: [`amqp://${process.env["RABBITMQ_URL"]}`],
          queue: await this.projectName(),
          queueOptions: {
            durable: false,
          },
        },
      });
    }
    await app.startAllMicroservices()
    await app.listen(this.serviceAddress.port);
    if (process.env["CONSUL_URL"]) {
      const tcpServer: net.Server = (app as any).server.server;
      this.registerService(tcpServer.address() as net.AddressInfo)
    }
    return app
  }
}