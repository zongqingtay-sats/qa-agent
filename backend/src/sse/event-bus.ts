import { Response } from 'express';

type SSEClient = {
  id: string;
  res: Response;
  channels: Set<string>;
};

class EventBus {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter = 0;

  /**
   * Register an SSE client. Returns a cleanup function.
   * Optionally subscribe to specific channels (e.g. "test-runs", "test-cases").
   * If no channels specified, client receives all events.
   */
  addClient(res: Response, channels?: string[]): string {
    const id = `sse-${++this.clientIdCounter}`;
    const client: SSEClient = {
      id,
      res,
      channels: new Set(channels || []),
    };
    this.clients.set(id, client);

    // Send initial connection event
    this.sendToClient(client, { type: 'connected', data: { clientId: id } });

    // Remove client on disconnect
    res.on('close', () => {
      this.clients.delete(id);
    });

    return id;
  }

  /**
   * Remove a client by ID
   */
  removeClient(id: string) {
    this.clients.delete(id);
  }

  /**
   * Emit an event to all clients subscribed to the given channel.
   * Clients with no channels receive all events.
   */
  emit(channel: string, event: string, data: any) {
    const payload = { type: event, channel, data };
    for (const client of this.clients.values()) {
      if (client.channels.size === 0 || client.channels.has(channel)) {
        this.sendToClient(client, payload);
      }
    }
  }

  private sendToClient(client: SSEClient, payload: any) {
    try {
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      this.clients.delete(client.id);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

// Singleton
export const eventBus = new EventBus();
