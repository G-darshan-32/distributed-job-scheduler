import { useQuery } from '@tanstack/react-query';
import { Settings, Database, Server, Wifi } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useAuthStore } from '../stores/auth.store';
import { wsClient } from '../lib/websocket';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.get('/health');
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Account and system configuration" />

      {/* Profile */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2">Profile</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-white">{user?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-white">{user?.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">User ID</dt>
            <dd className="text-white font-mono text-xs">{user?.id ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {/* System info */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2">System</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Database size={16} className={health?.services?.database === 'ok' ? 'text-green-400' : 'text-red-400'} />
            <div>
              <p className="text-xs text-gray-500">Database</p>
              <p className="text-sm font-medium text-white">{health?.services?.database ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Server size={16} className={health?.services?.redis === 'ok' ? 'text-green-400' : 'text-red-400'} />
            <div>
              <p className="text-xs text-gray-500">Redis</p>
              <p className="text-sm font-medium text-white">{health?.services?.redis ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Wifi size={16} className={wsClient.connected ? 'text-green-400' : 'text-yellow-400'} />
            <div>
              <p className="text-xs text-gray-500">WebSocket</p>
              <p className="text-sm font-medium text-white">{wsClient.connected ? 'Connected' : 'Reconnecting'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Settings size={16} className="text-blue-400" />
            <div>
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="text-sm font-medium text-white">
                {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* API info */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2">API</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">API Base URL</span>
            <code className="text-xs text-blue-400">{import.meta.env.VITE_API_URL}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">WebSocket URL</span>
            <code className="text-xs text-blue-400">{import.meta.env.VITE_WS_URL}</code>
          </div>
          <a
            href={`${import.meta.env.VITE_API_URL?.replace('/api/v1', '')}/api-docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Open Swagger API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}
