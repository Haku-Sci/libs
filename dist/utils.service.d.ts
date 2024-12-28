import { INestMicroservice } from '@nestjs/common';
export declare class MicroserviceLibModule {
    static projectName(): Promise<string>;
    private static registerService;
    private static register;
    static bootstrapMicroservice(appModule: any, customControllers?: any): Promise<INestMicroservice>;
}
