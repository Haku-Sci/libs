"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HealthModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthModule = void 0;
const common_1 = require("@nestjs/common");
const health_controller_1 = require("./health.controller");
let HealthModule = HealthModule_1 = class HealthModule {
    static forRoot() {
        return {
            module: HealthModule_1,
            controllers: [health_controller_1.HealthController],
        };
    }
};
exports.HealthModule = HealthModule;
exports.HealthModule = HealthModule = HealthModule_1 = __decorate([
    (0, common_1.Module)({})
], HealthModule);
//# sourceMappingURL=health.module.js.map