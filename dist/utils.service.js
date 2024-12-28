"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MicroserviceLibModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroserviceLibModule = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path = require("path");
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const axios_1 = require("axios");
const health_module_1 = require("./health/health.module");
let MicroserviceLibModule = MicroserviceLibModule_1 = class MicroserviceLibModule {
    static async projectName() {
        var data = await (0, promises_1.readFile)(path.join(process.cwd(), 'package.json'));
        const { name } = JSON.parse(data.toString());
        return name;
    }
    static async registerService(address) {
        const projectName = await this.projectName();
        const serviceData = {
            ID: projectName,
            Name: projectName,
            Address: address.address,
            Port: address.port,
            Check: {
                TCP: `${address.address}:${address.port}/is-alive`,
                Interval: "10s",
                Timeout: "5s",
                DeregisterCriticalServiceAfter: "1m"
            }
        };
        await axios_1.default.put(process.env["CONSUL_URL"], serviceData);
        console.log(`Service registered with Consul on ${address.address}:${address.port}`);
    }
    static register(appModule, additionalModules = []) {
        return {
            module: MicroserviceLibModule_1,
            imports: [appModule, health_module_1.HealthModule, ...additionalModules],
        };
    }
    static async bootstrapMicroservice(appModule, customControllers) {
        const app = await core_1.NestFactory.createMicroservice(MicroserviceLibModule_1.register(appModule, customControllers), {
            transport: microservices_1.Transport.TCP,
        });
        await app.listen();
        const tcpServer = app.server.server;
        this.registerService(tcpServer.address());
        return app;
    }
};
exports.MicroserviceLibModule = MicroserviceLibModule;
exports.MicroserviceLibModule = MicroserviceLibModule = MicroserviceLibModule_1 = __decorate([
    (0, common_1.Module)({})
], MicroserviceLibModule);
//# sourceMappingURL=utils.service.js.map