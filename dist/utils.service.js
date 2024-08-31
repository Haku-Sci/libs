"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var UtilsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtilsService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path = require("path");
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
let UtilsService = UtilsService_1 = class UtilsService {
    static async projectName() {
        var data = await (0, promises_1.readFile)(path.join(process.cwd(), 'package.json'));
        const { name } = JSON.parse(data.toString());
        return name;
    }
    static async port() {
        return this.listServices[await this.projectName()];
    }
    static microservicesClients() {
        return Object.keys(this.listServices).map(service => this.getServiceClient(service, this.listServices[service]));
    }
    static getServiceClient(service, port) {
        return {
            name: service.toUpperCase(),
            transport: microservices_1.Transport.TCP,
            options: {
                host: `${process.env["CURRENT_BRANCH_SUBENDPOINT"]}.${service.toLowerCase()}.${process.env["DOMAIN_NAME"]}`,
                port: port
            }
        };
    }
    static async bootstrapMicroservice(appModule) {
        const app = await core_1.NestFactory.createMicroservice(appModule, {
            transport: microservices_1.Transport.TCP,
            options: {
                host: process.env["DOMAIN_NAME"]
                    && `${process.env["CURRENT_BRANCH_SUBENDPOINT"]}.${await UtilsService_1.projectName()}.${process.env["DOMAIN_NAME"]}`
                    || "localhost",
                port: await UtilsService_1.port()
            }
        });
        await app.listen();
    }
};
exports.UtilsService = UtilsService;
UtilsService.listServices = JSON.parse(process.env["SERVICES"].replaceAll("'", '"'));
exports.UtilsService = UtilsService = UtilsService_1 = __decorate([
    (0, common_1.Injectable)()
], UtilsService);
//# sourceMappingURL=utils.service.js.map