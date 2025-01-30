import { INestMicroservice, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientProxy, ClientProxyFactory, MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import * as utils from '../utils'

export class MicroserviceService {
  private static serviceAddress: net.AddressInfo;
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

  private static async registerService() {
    const projectName = await utils.projectName();
    const serviceData = {
      ID: projectName,
      Name: projectName,
      Address: this.serviceAddress.address,
      Port: this.serviceAddress.port,
      Check: {
        TCP: `${this.serviceAddress.address}:${this.serviceAddress.port}`,
        Interval: "10s",
        Timeout: "5s",
        DeregisterCriticalServiceAfter: "1m"
      }
    };

    await axios.put(`${process.env["CONSUL_URL"]}/v1/agent/service/register`, serviceData);
    console.log(`Service registered with Consul on ${this.serviceAddress.address}:${this.serviceAddress.port}`);
  }

  private static async getServerAddress(): Promise<net.AddressInfo> {
    if (process.env.AWS_REGION)
      return{
        address:`haku-sci-${await utils.projectName()}-${process.env.BRANCH}.${process.env.AWS_REGION}.elasticbeanstalk.com`,
        port:3000
      } as net.AddressInfo 
    // Create a new TCP serveur to get an available port
    const server = net.createServer();
    server.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address() as net.AddressInfo;
    address.address = 'localhost';
    address.family = 'IPv4';
    server.close();
    return address;
  }
  
  private  static async startMainMicroService(appModule): Promise<INestMicroservice> {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule,
      {
        transport: Transport.TCP,
        options: {
          port: this.serviceAddress.port
        }
      },
    );
    await app.listen();
    return app;
  }

  private static async startRabbitMQMicroService(appModule): Promise<INestMicroservice> {
    const queue=await utils.projectName();
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule, {
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

  static async bootstrapMicroservice(appModule): Promise<INestMicroservice> {
    this.serviceAddress=await this.getServerAddress();
      
    // Initialize the database if needed
    if (process.env["RDS_DBNAME"]){
      const postGresService=require ('./postgres.service');
      postGresService.createDatabaseIfNotExists()
    }
      
    // Generate Microservice
    const app = await this.startMainMicroService(appModule);
    // Start rabbitmq
    if (process.env.RABBITMQ_URL)
      await this.startRabbitMQMicroService(appModule);
    
    // Register service with consul
    if (process.env["CONSUL_URL"])
      this.registerService()
    return app
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
}