import { useAuthStore } from '../stores/auth.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000';

type MessageHandler = (data: unknown) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;

  connect(): void {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    this.ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

    this.ws.onopen = () => {
      this.isConnected = true;
      // Subscribe to all channels
      this.ws?.send(JSON.stringify({ type: 'subscribe', channel: '*' }));
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const channel = msg.channel ?? '*';
        const handlers = this.handlers.get(channel);
        handlers?.forEach((h) => h(msg.data));
        this.handlers.get('*')?.forEach((h) => h(msg));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.isConnected = false;
  }

  on(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    return () => this.handlers.get(channel)?.delete(handler);
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export const wsClient = new WSClient();
