import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Activity, WifiOff, StopCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';

export default function WorkersPage() {
  const qc = useQueryClient();

  const { data: workers, isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data } = await api.get('/workers');
      return data.data as Array<{
        id: string; hostname: string; pid: number; status: string;
        concurrency: number; activeJobs: number; totalJobsDone: number;
        lastSeenAt: string; startedAt: string; version?: string;
        _count: { executions: number };
      }>;
    },
    refetchInterval: 10000,
  });

  const drain = useMutation({
    mutationFn: (id: string) => api.post(`/workers/${id}/drain`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
  });

  const active = workers?.filter((w) => w.status !== 'OFFLINE').length ?? 0;
  const totalJobs = workers?.reduce((a, w) => a + w.totalJobsDone, 0) ?? 0;
  const totalActive = workers?.reduce((a, w) => a + w.activeJobs, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Workers" subtitle="Monitor worker nodes and their health" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Workers" value={active} icon={Cpu} color="green" />
        <StatCard label="Running Jobs" value={totalActive} icon={Activity} color="blue" />
        <StatCard label="Total Processed" value={totalJobs} icon={Activity} color="purple" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !workers?.length ? (
        <EmptyState
          icon={Cpu}
          title="No workers registered"
          description="Start a worker process to begin processing jobs."
        />
      ) : (
        <div className="space-y-4">
          {workers.map((w) => (
            <WorkerCard
              key={w.id}
              worker={w}
              onDrain={() => drain.mutate(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerCard({
  worker,
  onDrain,
}: {
  worker: {
    id: string; hostname: string; pid: number; status: string;
    concurrency: number; activeJobs: number; totalJobsDone: number;
    lastSeenAt: string; startedAt: string; version?: string;
    _count: { executions: number };
  };
  onDrain: () => void;
}) {
  const { data: heartbeats } = useQuery({
    queryKey: ['heartbeats', worker.id],
    queryFn: async () => {
      const { data } = await api.get(`/workers/${worker.id}/heartbeats`, { params: { minutes: 30 } });
      return data.data as Array<{ timestamp: string; activeJobs: number; memoryUsage?: number }>;
    },
    refetchInterval: 15000,
  });

  const chartData = heartbeats?.map((h) => ({
    time: format(new Date(h.timestamp), 'HH:mm'),
    jobs: h.activeJobs,
    mem: h.memoryUsage ? Math.round(h.memoryUsage / 1024 / 1024) : 0,
  })) ?? [];

  const utilPct = worker.concurrency > 0
    ? Math.round((worker.activeJobs / worker.concurrency) * 100)
    : 0;

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${worker.status === 'OFFLINE' ? 'bg-gray-800' : 'bg-green-500/10'}`}>
          {worker.status === 'OFFLINE'
            ? <WifiOff size={20} className="text-gray-500" />
            : <Cpu size={20} className="text-green-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-white">{worker.hostname}</span>
            <span className="text-xs text-gray-500">PID {worker.pid}</span>
            <StatusBadge status={worker.status} />
            {worker.version && <span className="badge bg-gray-700/50 text-gray-400">v{worker.version}</span>}
          </div>
          <p className="text-xs text-gray-600 font-mono mt-0.5">{worker.id}</p>
          <div className="mt-2 flex items-center gap-6 text-xs text-gray-400 flex-wrap">
            <span>Concurrency: <strong className="text-white">{worker.activeJobs}/{worker.concurrency}</strong></span>
            <span>Total done: <strong className="text-white">{worker.totalJobsDone}</strong></span>
            <span>Last seen: <strong className="text-white">
              {formatDistanceToNow(new Date(worker.lastSeenAt), { addSuffix: true })}
            </strong></span>
            <span>Started: <strong className="text-white">
              {format(new Date(worker.startedAt), 'MMM d HH:mm')}
            </strong></span>
          </div>
          {/* Utilization bar */}
          <div className="mt-2">
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-48">
              <div
                className={`h-full rounded-full transition-all ${utilPct > 80 ? 'bg-red-500' : utilPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 mt-0.5">{utilPct}% utilization</span>
          </div>
        </div>
        {worker.status !== 'OFFLINE' && worker.status !== 'DRAINING' && (
          <button className="btn-ghost p-2" onClick={onDrain} title="Drain worker">
            <StopCircle size={16} className="text-orange-400" />
          </button>
        )}
      </div>

      {/* Heartbeat chart */}
      {chartData.length > 1 && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500 mb-2">Active Jobs (last 30 min)</p>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="jobs" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
