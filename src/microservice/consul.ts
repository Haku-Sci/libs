import axios from "axios";
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as utils from '../utils'
import { Logger, ServiceUnavailableException } from '@nestjs/common';

// Checked in insertion order (https before http, since a more specific class should
// win over a more generic base it extends) - the value is the Consul name suffix.
const SERVER_CLASS_TRANSPORTS = new Map<Function, string>([
  [https.Server, 'https'],
  [http.Server, 'http'],
]);

export class Consul {
  static async registerService(server: net.AddressInfo | net.Server, logger: Logger) {
    if (!process.env["CONSUL_URL"])
      return;
    const isServerInstance = typeof (server as net.Server)?.address === 'function';
    // A just-started server's address isn't available until it's actually listening.
    if (isServerInstance && (server as net.Server).address() === null)
      await new Promise<void>((resolve) => (server as net.Server).once('listening', resolve));
    const serverAddress = (isServerInstance ? (server as net.Server).address() : server) as net.AddressInfo;
    // tcp is the default/exception (no suffix) - anything else is suffixed with its own name.
    // Extend this table, not the lookup logic, to recognize another server class.
    const transport = isServerInstance
      ? [...SERVER_CLASS_TRANSPORTS].find(([cls]) => server instanceof cls)?.[1] ?? 'tcp'
      : 'tcp';

    const externalAddress=process.env.SERVICE_PRIVATE_HOSTNAME||process.env.SERVICE_PUBLIC_HOSTNAME || serverAddress.address;
    const externalPort=parseInt(process.env.SERVICE_PUBLIC_PORT) || serverAddress.port
    const microServiceName = transport === 'tcp'
      ? await utils.microServiceName()
      : `${await utils.microServiceName()}-${transport}`;
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