export declare class UtilsService {
    static listServices: Record<string, number>;
    static projectName(): Promise<string>;
    static port(): Promise<number>;
    static microservicesClients(): any[];
    private static getServiceClient;
}
