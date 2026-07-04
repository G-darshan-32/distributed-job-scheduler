import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, CheckCircle, XCircle, Clock, Skull } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

export default function DashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const { data } = await api.get('/workers/metrics');
      return data.data;
    },
    refetchInterval: 10000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.get('/health');
      return data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const jobs = metrics?.jobs ?? {};
  const workers = metrics?.workers ?? {};

  const jobStatusData = Object.entries(jobs).map(([name, value]) => ({ name, value }));

  const totalJobs = Object.values(jobs).reduce((a: number, b) => a + (b as number), 0);
  const runningWorkers = (workers['ACTIVE'] ?? 0) + (workers['IDLE'] ?? 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="System overview and real-time metrics"
        actions={
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">
              {health?.status === 'ok' ? 'All systems operational' : 'Degraded'}
            </span>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={totalJobs} icon={Activity} color="blue" />
        <StatCard label="Running Workers" value={runningWorkers} icon={Cpu} color="green" />
        <StatCard label="Completed" value={jobs['COMPLETED'] ?? 0} icon={CheckCircle} color="green" />
        <StatCard label="Failed / Dead" value={(jobs['FAILED'] ?? 0) + (jobs['DEAD'] ?? 0)} icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Job Status Distribution */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Job Status Distribution</h3>
          {jobStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={jobStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {jobStatusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">No data</div>
          )}
        </div>

        {/* Worker Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Worker Status</h3>
          <div className="space-y-3">
            {Object.entries(workers).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{status}</span>
                <span className="text-sm font-semibold text-white">{count as number}</span>
              </div>
            ))}
            {Object.keys(workers).length === 0 && (
              <p className="text-sm text-gray-600">No workers registered</p>
            )}
          </div>
        </div>

        {/* Health Checks */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Service Health</h3>
          <div className="space-y-3">
            {Object.entries(health?.services ?? {}).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm text-gray-400 capitalize">{service}</span>
                <span className={`text-xs font-medium ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                  {status as string}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <span className="text-sm text-gray-400">WS Clients</span>
              <span className="text-sm font-medium text-white">{health?.websocketClients ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Uptime</span>
              <span className="text-sm font-medium text-white">
                {Math.floor((health?.uptime ?? 0) / 60)}m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
