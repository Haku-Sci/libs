import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as https from 'https';
import { readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { Logger } from '@nestjs/common';
import * as utils from '../utils';
import { TicketService } from './ticket.service';
import { BridgeRegistry, BridgeContext } from './bridge-registry.service';
import { dispatchMessage } from './utils';

export interface WssSslOptions {
  key: Buffer | string;
  cert: Buffer | string;
}

export interface WssBootstrapOptions {
  server?: http.Server | https.Server;
  port?: number;
  ssl?: WssSslOptions;
  onDisconnect?: (context: BridgeContext) => void;
}

export class WssMicroservice {
  private static logger = new Logger('WssMicroservice');
  private static wss: WebSocketServer;
  private static publicHost: string;
  private static publicPort: number;
  private static ssl: boolean;

  static async bootstrap(options: WssBootstrapOptions = {}): Promise<WebSocketServer> {
    let server = options.server;

    if (!server) {
      const address = process.env.ADDRESS || '0.0.0.0';
      const port = Number(process.env.WSS_PORT) || options.port || 3001;
      const ssl = options.ssl ?? await this.resolveSsl();
      server = ssl ? https.createServer(ssl) : http.createServer();
      server.on('request', (req, res) => this.handleHttpRequest(req, res));
      server.listen(port, address);
      this.logger.log(`address to be listened to: ${address}`);
      this.logger.log(`port to be listened to: ${port}`);
      this.logger.log(`ssl: ${ssl ? 'enabled' : 'disabled'}`);

      this.publicHost = process.env.WSS_URL || address;
      this.publicPort = Number(process.env.WSS_PUBLIC_PORT) || port;
      this.ssl = !!ssl;
    } else {
      this.publicHost = process.env.WSS_URL;
      this.publicPort = Number(process.env.WSS_PUBLIC_PORT) || options.port;
      this.ssl = !!options.ssl || server instanceof https.Server;
    }

    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req, options));
    this.logger.log('WSS microservice started');
    return this.wss;
  }

  /**
   * Public wss(s)://host:port URL clients should connect to, e.g. via WSS_URL when
   * the bind address (ADDRESS, often 0.0.0.0 or an internal container IP) isn't
   * externally reachable.
   */
  static get url(): string {
    if (!this.publicHost) {
      throw new Error('WssMicroservice.url requested before bootstrap() (or WSS_URL is not set)');
    }
    return `${this.ssl ? 'wss' : 'ws'}://${this.publicHost}:${this.publicPort}`;
  }

  /**
   * Resolves SSL from explicit WSS_SSL_KEY_PATH/WSS_SSL_CERT_PATH env vars if set,
   * otherwise falls back to the conventional mkcert certificate for this service
   * (./certificates/<service>.haku-test.com) when DEBUG=true, mirroring collab's setup.
   */
  private static async resolveSsl(): Promise<WssSslOptions | null> {
    const keyPath = process.env.WSS_SSL_KEY_PATH;
    const certPath = process.env.WSS_SSL_CERT_PATH;
    if (keyPath && certPath) {
      return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    }

    if (process.env.DEBUG !== 'true') return null;

    const domain = `${await utils.microServiceName()}.haku-test.com`;
    return {
      key: readFileSync(`./certificates/${domain}-key.pem`),
      cert: readFileSync(`./certificates/${domain}.pem`),
    };
  }

  private static handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== '/health') {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: BridgeRegistry.size }));
  }

  private static handleConnection(ws: WebSocket, req: IncomingMessage, options: WssBootstrapOptions): void {
    const url = new URL(req.url ?? '', 'http://localhost');
    const ticket = url.searchParams.get('ticket');
    const ticketData = ticket ? TicketService.consume(ticket) : null;

    if (!ticketData) {
      ws.close(4001, 'invalid or expired ticket');
      return;
    }

    const context = BridgeRegistry.register(ticketData.id, ticketData.properties, ws);

    ws.on('message', (raw) => {
      dispatchMessage(context.id, context.properties, parseMessage(raw.toString()));
    });

    ws.on('close', () => {
      BridgeRegistry.unregister(ws);
      options.onDisconnect?.(context);
    });
  }
}

function parseMessage(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
