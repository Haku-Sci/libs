import * as crypto from 'crypto';

export interface TicketData {
  id: any;
  properties: Record<string, any>;
}

interface TicketEntry extends TicketData {
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5000;
const SWEEP_INTERVAL_MS = 1000;

export class TicketService {
  private static tickets = new Map<string, TicketEntry>();
  private static sweepInterval: NodeJS.Timeout | null = null;

  static create(id: any, properties: Record<string, any> = {}): string {
    this.ensureSweep();
    const ticket = crypto.randomBytes(32).toString('hex');
    this.tickets.set(ticket, { id, properties, expiresAt: Date.now() + DEFAULT_TTL_MS });
    return ticket;
  }

  static consume(ticket: string): TicketData | null {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    if (entry.expiresAt < Date.now()) return null;
    return { id: entry.id, properties: entry.properties };
  }

  private static ensureSweep(): void {
    if (this.sweepInterval) return;
    this.sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [ticket, entry] of this.tickets) {
        if (entry.expiresAt < now) this.tickets.delete(ticket);
      }
    }, SWEEP_INTERVAL_MS);
    this.sweepInterval.unref?.();
  }
}
