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
  private static readonly serviceURICache = new Map<string, { host: string, port: number }>();
  private static readonly logger = new Logger(Consul.name);

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

  static async getServiceURI(serviceName: string, forceRefresh = false): Promise<{ host: string, port: number }> {
    if (!forceRefresh && Consul.serviceURICache.has(serviceName))
      return Consul.serviceURICache.get(serviceName);

    const url = `${process.env["CONSUL_URL"]}/v1/catalog/service/${serviceName}`;
    let response = await axios.get(url);
    // A refresh means the known address just failed: the service may be restarting, so block on
    // the catalog (Consul blocking query) until it re-registers or CONSUL_WAIT elapses.
    const deadline = Date.now() + (parseInt(process.env.CONSUL_WAIT) || 10000);
    if (forceRefresh && response.data.length === 0)
      Consul.logger.warn(`Service ${serviceName} missing from Consul catalog, waiting for it to register`);
    while (forceRefresh && response.data.length === 0 && Date.now() < deadline) {
      response = await axios.get(url, {
        params: { index: response.headers['x-consul-index'], wait: `${deadline - Date.now()}ms` },
      });
    }
    const serviceInfo = response.data;

    if (serviceInfo.length > 0) {
      const service = serviceInfo[0];
      const uri = {
        host: service.ServiceAddress || service.Address,
        port: service.ServicePort,
      };
      Consul.serviceURICache.set(serviceName, uri);
      return uri;
    } else {
      Consul.serviceURICache.delete(serviceName);
      throw new ServiceUnavailableException(`Service ${serviceName} not found in Consul catalog`);
    }
  }
}