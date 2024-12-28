export declare class MicroserviceLib {
    static projectName(): Promise<string>;
    private static getServiceURI;
    static sendTCPMessage(service: any, messagePattern: any, payload?: any): Promise<any>;
    private static registerService;
    static bootstrapMicroservice(appModule: any): Promise<void>;
}
