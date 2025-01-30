import { readFile } from 'fs/promises';
import * as path from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';

export function executeFunction<F extends (...args: any[]) => any>(
  parent: any,
  funcName: string,
  params: Record<string, any>,
): ReturnType<F> {
  const func=parent[funcName]
  const boundFunc = func.bind(parent);

  // Obtenir les noms des paramètres de la fonction
  const paramNames = getFunctionParameterNames(func);

  // Reconstituer les arguments dans le bon ordre
  const args = paramNames.map(name => params[name]);

  // Appeler la fonction avec les arguments
  return boundFunc(...args);
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

export async function projectName(): Promise<string> {
  if (!this.msName) {
    var data = await readFile(
      path.join(
        process.cwd(),
        'package.json',
      )
    )
    const { name } = JSON.parse(data.toString());
    this.msName = name;
  }
  return this.msName;
}

export function withWatchdog<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new HttpException(`Gateway Timeout`,HttpStatus.GATEWAY_TIMEOUT));
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

