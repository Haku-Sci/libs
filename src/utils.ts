import { readFile } from 'fs/promises';
import * as path from 'path';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as net from 'net';
import * as os from 'os';
export const HAKU_SCI_RESOURCE = 'haku:resource';
export const HAKU_SCI_ACTION = 'haku:action';

export function executeFunction<F extends (...args: any[]) => any>(
  parent: any,
  funcName: string,
  params: Record<string, any>,
): ReturnType<F> {
  const func = parent[funcName]
  const boundFunc = func.bind(parent);

  // Appeler la fonction avec les arguments
  return boundFunc(...getSortedParameters(func, params));
}

export function getSortedParameters(func: Function, params: Record<string, any>): string[] {
  const paramNames = getFunctionParameterNames(func);
  return paramNames.map(name => params[name]);
}

function getFunctionParameterNames(func: Function): string[] {
  const fnStr = func.toString();
  const paramMatch = fnStr.match(/\(([^)]*)\)/);
  if (!paramMatch || !paramMatch[1]) {
    return [];
  }

  return paramMatch[1]
    .split(",")
    .map(param => param.trim())
    .filter(param => param);
}

let _msName: string | undefined;

export async function microServiceName(): Promise<string> {
  if (!_msName) {
    const data = await readFile(path.join(process.cwd(), 'package.json'));
    const { name } = JSON.parse(data.toString());
    _msName = name;
  }
  return _msName!;
}

export function getHttpRequestMaxSize(requestMaxSize?: string): number {
  return (parseInt(requestMaxSize ?? process.env.REQUEST_MAX_SIZE ?? '100', 10) - 10) * 1024;
}

export interface ServerAddress {
  address: string;
  port: number;
}

function isPortFree(port: number, address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));

    server.listen(port, address);
  });
}

export async function resolveServerAddress(defaultPort: number, portEnvVar: string, logger?: Logger): Promise<ServerAddress> {
  const address: string = process.env.ADDRESS || (process.env.DEBUG && "127.0.0.1") || Object.values(os.networkInterfaces())
    .flatMap((iface) => iface ?? []) // filtre null/undefined
    .find((addr) => addr.family === 'IPv4' && !addr.internal)
    .address;

  let port = defaultPort;
  const envPort = parseInt(process.env[portEnvVar]);
  if (!isNaN(envPort))
    port = envPort;
  else
    while (!await isPortFree(port, address)) port++;

  logger?.log("address to be listened to: " + address);
  logger?.log("port to be listened to: " + port);

  return { address, port };
}

export function withWatchdog<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new HttpException(`Gateway Timeout`, HttpStatus.GATEWAY_TIMEOUT));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}