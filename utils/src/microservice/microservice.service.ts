import { INestMicroservice, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ClientProxy, ClientProxyFactory, MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as net from 'net';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MicroserviceService { 
  static async projectName(): Promise<string> {
    var data = await readFile(
        path.join(
            process.cwd(),
            'package.json',
        )
    )
    const { name } = JSON.parse(data.toString());
    return name;
  }
    
  private static async getServiceURI(serviceName: string) :Promise<{host: string, port: number}> {
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

  static async sendTCPMessage(service, messagePattern, payload?):Promise<any>{
    const client: ClientProxy = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: await MicroserviceService.getServiceURI(service),
    });
    try {
      const result = await lastValueFrom(await client.send(messagePattern, payload));
      return result;
    } catch (error) {
      throw error;
    } finally {
      client.close();
    }
  }

  private static async registerService(address: net.AddressInfo) {
    const projectName=await this.projectName();
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

  static async bootstrapMicroservice(appModule):Promise<INestMicroservice> {
    // Create a new TCP serveur to get an availanble port
    const server = net.createServer();
    server.listen(0); 
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address() as net.AddressInfo;

    //Generate Microservice
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
      appModule,
      {
        transport: Transport.TCP,
        options:{
          port:address.port
        }
      },
    );
    await app.listen();
    if (process.env["CONSUL_URL"]){
      const tcpServer: net.Server = (app as any).server.server;
      this.registerService(tcpServer.address() as net.AddressInfo)
    } 
    return app    
  }
}