"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const utils_service_1 = require("./utils.service");
describe('UtilsService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [utils_service_1.UtilsService],
        }).compile();
        service = module.get(utils_service_1.UtilsService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=utils.service.spec.js.map