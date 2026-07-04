import { useEffect } from 'react';
import { wsClient } from '../lib/websocket';

export function useWebSocket(channel: string, handler: (data: unknown) => void) {
  useEffect(() => {
    const unsubscribe = wsClient.on(channel, handler);
    return unsubscribe;
  }, [channel, handler]);
}
