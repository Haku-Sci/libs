import { INestApplication, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ClientProxy, ClientProxyFactory, MicroserviceOptions, NestMicroservice, Transport } from '@nestjs/microservices';
import * as net from 'net';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import { Client } from "pg"; // Make sure the 'pg' package is installed

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
        urls: [`${process.env["RABBITMQ_URL"]}`],
        queue: queue,
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

  private static async registerService() {
    const projectName = await this.projectName();
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

  private static async getLocalServerAddress(): Promise<net.AddressInfo> {
    // Create a new TCP serveur to get an available port
    const server = net.createServer();
    server.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address() as net.AddressInfo;
    address.address = "localhost";
    server.close();
    return address;
  }
  static async bootstrapMicroservice(appModule): Promise<INestApplication> {
    this.serviceAddress=!process.env["AWS_REGION"]?
      await this.getLocalServerAddress():
      {
        address:`haku-sci-${process.env["AWS_APPLICATION"]}-${process.env["AWS_BRANCH"]}.${process.env["AWS_REGION"]}.elasticbeanstalk.com`,
        port:3000
      } as net.AddressInfo 
      
    // Initialize the database if needed
    if (process.env["RDS_DBNAME"])
      this.createDatabaseIfNotExists()

    // Generate Microservice
    const app = await NestFactory.create(appModule)
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.TCP,
        options: {
          port: this.serviceAddress.port
        }
      },
    );

    // Start rabbitmq
    if (process.env["RABBITMQ_URL"]) {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
          urls: [`${process.env["RABBITMQ_URL"]}`],
          queue: await this.projectName(),
          queueOptions: {
            durable: false,
          },
        },
      });
    }

    // start services
    await app.startAllMicroservices()
    await app.listen(0);
    if (process.env["CONSUL_URL"])
      this.registerService()
    return app
  }

  private static async createDatabaseIfNotExists() {
    const client = new Client({
      host: process.env["RDS_HOSTNAME"],
      port: process.env["RDS_PORT"],
      user: process.env["RDS_USERNAME"],
      password: process.env["RDS_PASSWORD"],
      database: "postgres", // Connect to the default 'postgres' database
    });

    try {
      await client.connect();
      const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [process.env["RDS_DBNAME"]]);

      if (result.rowCount === 0) {
        console.log(`Database "${process.env["RDS_DBNAME"]}" does not exist. Creating...`);
        await client.query(`CREATE DATABASE "${process.env["RDS_DBNAME"]}"`);
        console.log(`Database "${process.env["RDS_DBNAME"]}" created successfully.`);
      }
    } finally {
      await client.end();
    }
  }

}