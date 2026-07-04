import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { logger } from './logger';
import { verifyAccessToken } from '../utils/jwt';

interface WSClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>; // channel keys like "queue:uuid", "job:uuid"
}

const clients = new Map<string, WSClient>();

export function initWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = extractToken(req);
    if (!token) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const clientId = `${payload.sub}-${Date.now()}`;
    const client: WSClient = { ws, userId: payload.sub, subscriptions: new Set() };
    clients.set(clientId, client);
    logger.debug('WebSocket client connected', { clientId, userId: payload.sub });

    ws.send(JSON.stringify({ type: 'connected', clientId }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(clientId, msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      logger.debug('WebSocket client disconnected', { clientId });
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error', { clientId, error: err.message });
      clients.delete(clientId);
    });
  });

  logger.info('WebSocket server initialized');
  return wss;
}

function handleMessage(clientId: string, msg: { type: string; channel?: string }) {
  const client = clients.get(clientId);
  if (!client) return;

  if (msg.type === 'subscribe' && msg.channel) {
    client.subscriptions.add(msg.channel);
  } else if (msg.type === 'unsubscribe' && msg.channel) {
    client.subscriptions.delete(msg.channel);
  }
}

export function broadcast(channel: string, data: unknown): void {
  const payload = JSON.stringify({ channel, data, ts: Date.now() });
  clients.forEach((client) => {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      (client.subscriptions.has(channel) || client.subscriptions.has('*'))
    ) {
      client.ws.send(payload);
    }
  });
}

export function broadcastAll(data: unknown): void {
  const payload = JSON.stringify({ data, ts: Date.now() });
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

function extractToken(req: IncomingMessage): string | null {
  const url = req.url ?? '';
  const match = url.match(/[?&]token=([^&]+)/);
  if (match) return match[1];
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function getConnectedClientCount(): number {
  return clients.size;
}
