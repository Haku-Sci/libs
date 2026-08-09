import { WebSocket } from 'ws';
import { BridgeRegistry } from './bridge-registry.service';

export type SendToUserResult =
  | { ok: true }
  | { ok: false; reason: 'not_connected' | 'timeout' | 'send_failed'; error?: Error };

export type MessageHandler = (id: any, properties: Record<string, any>, message: any) => void;

const DEFAULT_SEND_TIMEOUT_MS = 5000;

let messageHandler: MessageHandler | null = null;

export function onMessage(handler: MessageHandler): void {
  messageHandler = handler;
}

export function dispatchMessage(id: any, properties: Record<string, any>, message: any): void {
  messageHandler?.(id, properties, message);
}

export function sendToUser(id: any, message: any, timeoutMs = DEFAULT_SEND_TIMEOUT_MS): Promise<SendToUserResult> {
  const context = BridgeRegistry.getById(id);
  if (!context || context.ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, reason: 'not_connected' });
  }

  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);

    context.ws.send(JSON.stringify(message), (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(error ? { ok: false, reason: 'send_failed', error } : { ok: true });
    });
  });
}
