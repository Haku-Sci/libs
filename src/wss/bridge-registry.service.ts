import { WebSocket } from 'ws';
import { canonicalKey } from './canonical-key';

export interface BridgeContext {
  id: any;
  properties: Record<string, any>;
  ws: WebSocket;
}

export class BridgeRegistry {
  private static byId = new Map<string, BridgeContext>();
  private static byWs = new Map<WebSocket, BridgeContext>();

  static register(id: any, properties: Record<string, any>, ws: WebSocket): BridgeContext {
    const key = canonicalKey(id);
    const stale = this.byId.get(key);
    if (stale) this.unregister(stale.ws);

    const context: BridgeContext = { id, properties, ws };
    this.byId.set(key, context);
    this.byWs.set(ws, context);
    return context;
  }

  static unregister(ws: WebSocket): void {
    const context = this.byWs.get(ws);
    if (!context) return;
    this.byWs.delete(ws);
    const key = canonicalKey(context.id);
    if (this.byId.get(key) === context) this.byId.delete(key);
  }

  static getByWs(ws: WebSocket): BridgeContext | undefined {
    return this.byWs.get(ws);
  }

  static getById(id: any): BridgeContext | undefined {
    return this.byId.get(canonicalKey(id));
  }

  static get size(): number {
    return this.byId.size;
  }
}
