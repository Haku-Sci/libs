import axios from "axios";
import * as net from 'net';
import * as utils from '../utils'
import { Logger, ServiceUnavailableException } from '@nestjs/common';
export class Consul {
  static async registerService(serverAddress: net.AddressInfo, logger: Logger) {
    if (!process.env["CONSUL_URL"])
      return;
    const externalAddress=process.env.SERVICE_PUBLIC_HOSTNAME || serverAddress.address;
    const externalPort=parseInt(process.env.SERVICE_PUBLIC_PORT) || serverAddress.port
    const microServiceName = await utils.microServiceName();
    const serviceData = {
      ID: microServiceName,
      Name: microServiceName,
      Address: externalAddress,
      Port: externalPort,
      Check: {
        TCP: `${externalAddress}:${externalPort}`,
        Interval: "10s",
        Timeout: "5s",
        DeregisterCriticalServiceAfter: "1m"
      }
    };

    await axios.put(`${process.env["CONSUL_URL"]}/v1/agent/service/register`, serviceData);
    logger.log(`Service registered with Consul on ${externalAddress}:${externalPort}`);
  }

  static async getServiceURI(serviceName: string): Promise<{ host: string, port: number }> {
    const response = await axios.get(`${process.env["CONSUL_URL"]}/v1/catalog/service/${serviceName}`);
    const serviceInfo = response.data;

    if (serviceInfo.length > 0) {
      const service = serviceInfo[0];
      const address = service.ServiceAddress || service.Address;
      const port = service.ServicePort;
      return {
        host: address,
        port: port,
      };
    } else {
      throw new ServiceUnavailableException(`Service ${serviceName} not found in Consul catalog`);
    }
  }
}