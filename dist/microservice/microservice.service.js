"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var Microservice_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Microservice = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path = require("path");
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const axios_1 = require("axios");
const rxjs_1 = require("rxjs");
let Microservice = Microservice_1 = class Microservice {
    static async projectName() {
        var data = await (0, promises_1.readFile)(path.join(process.cwd(), 'package.json'));
        const { name } = JSON.parse(data.toString());
        return name;
    }
    static async getServiceURI(serviceName) {
        const response = await axios_1.default.get(`${process.env["CONSUL_URL"]}/v1/catalog/service/${serviceName}`);
        const serviceInfo = response.data;
        if (serviceInfo.length > 0) {
            const service = serviceInfo[0];
            const address = service.ServiceAddress || service.Address;
            const port = service.ServicePort;
            return {
                host: address,
                port: port,
            };
        }
        else {
            throw new common_1.NotFoundException(`Service ${serviceName} not found in Consul catalog`);
        }
    }
    static async sendTCPMessage(service, messagePattern, payload) {
        const client = microservices_1.ClientProxyFactory.create({
            transport: microservices_1.Transport.TCP,
            options: await Microservice_1.getServiceURI(service),
        });
        try {
            const result = await (0, rxjs_1.lastValueFrom)(await client.send(messagePattern, payload));
            return result;
        }
        catch (error) {
            throw error;
        }
        finally {
            client.close();
        }
    }
    static async registerService(address) {
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
        await axios_1.default.put(`${process.env["CONSUL_URL"]}/v1/agent/service/register`, serviceData);
        console.log(`Service registered with Consul on ${address.address}:${address.port}`);
    }
    static async bootstrapMicroservice(appModule) {
        const app = await core_1.NestFactory.createMicroservice(appModule, {
            transport: microservices_1.Transport.TCP,
        });
        await app.listen();
    }
};
exports.Microservice = Microservice;
exports.Microservice = Microservice = Microservice_1 = __decorate([
    (0, common_1.Injectable)()
], Microservice);
//# sourceMappingURL=microservice.service.js.map