import { Injectable } from '@nestjs/common';
import { Transport } from "@nestjs/microservices";
import { readFile } from 'fs/promises';
import * as path from 'path';

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
}
