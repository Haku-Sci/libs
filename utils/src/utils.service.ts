import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
@Injectable()
export class UtilsService { 
    
    private static listServices: Record<string, number> = JSON.parse(process.env["SERVICES"].replaceAll("'", '"'))
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
    static async port(): Promise<number> {
        return this.listServices[await this.projectName()]
    }

    static microservicesClients(): any[] {
    return Object.keys(this.listServices).map(service => this.getServiceClient(service,this.listServices[service]));
}

private static getServiceClient(service: string, port?: number): { name, transport, options } {
    return {
        name: service.toUpperCase(),
        transport: Transport.TCP,
        options: {
            host: `${process.env["CURRENT_BRANCH_SUBENDPOINT"]}.${service.toLowerCase()}.${process.env["DOMAIN_NAME"]}`,
            port: port
        }
    }
}

static async bootstrapMicroservice(appModule) {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
      appModule,
      {
        transport: Transport.TCP,
        options:{
          host: process.env["DOMAIN_NAME"]
            && `${process.env["CURRENT_BRANCH_SUBENDPOINT"]}.${await UtilsService.projectName()}.${process.env["DOMAIN_NAME"]}` 
            ||"localhost",
          port:await UtilsService.port()
        }
      },
    );
    await app.listen();
  }
}