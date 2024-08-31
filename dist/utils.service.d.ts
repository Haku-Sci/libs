export declare class UtilsService {
    private static listServices;
    static projectName(): Promise<string>;
    static port(): Promise<number>;
    static microservicesClients(): any[];
    private static getServiceClient;
    static bootstrapMicroservice(appModule: any): Promise<void>;
}
