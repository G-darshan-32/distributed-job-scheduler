import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Plus, RotateCcw, XCircle, Search,
  ChevronRight, Loader2, BarChart3,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import Pagination from '../components/Pagination';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const JOB_TYPES = ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH'];
const JOB_STATUSES = ['PENDING', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD'];

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH']).default('IMMEDIATE'),
  payload: z.string().default('{}'),
  priority: z.coerce.number().default(0),
  runAt: z.string().optional(),
  cronExpression: z.string().optional(),
  maxAttempts: z.coerce.number().min(1).max(100).default(3),
  idempotencyKey: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function JobsPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', queueId, page, search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get(`/queues/${queueId}/jobs`, {
        params: { page, limit: 20, search: search || undefined, status: statusFilter || undefined },
      });
      return data;
    },
    refetchInterval: 8000,
  });

  const { data: metricsData } = useQuery({
    queryKey: ['job-metrics', queueId],
    queryFn: async () => {
      const { data } = await api.get(`/queues/${queueId}/jobs/metrics`);
      return data.data;
    },
    refetchInterval: 30000,
  });

  // Live updates via WebSocket
  const handleWsMessage = useCallback(() => refetch(), [refetch]);
  useWebSocket(`queue:${queueId}`, handleWsMessage);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'IMMEDIATE', payload: '{}', priority: 0, maxAttempts: 3 },
  });
  const jobType = watch('type');

  const create = useMutation({
    mutationFn: async (body: Form) => {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(body.payload); } catch { payload = {}; }
      await api.post(`/queues/${queueId}/jobs`, { ...body, payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); setOpen(false); reset(); },
  });

  const retryJob = useMutation({
    mutationFn: (jobId: string) => api.post(`/queues/${queueId}/jobs/${jobId}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const cancelJob = useMutation({
    mutationFn: (jobId: string) => api.post(`/queues/${queueId}/jobs/${jobId}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const jobs = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };

  const hourlyChart = Object.entries(metricsData?.hourly ?? {}).map(([k, v]) => ({ name: k, count: v }));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="View and manage jobs in this queue"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Dispatch Job</button>}
      />

      {/* Metrics bar */}
      {hourlyChart.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Last Hour Activity</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourlyChart} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-8"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto min-w-36"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Jobs table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description="Dispatch a job to get started."
          action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Dispatch Job</button>}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Attempts</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {jobs.map((job: {
                  id: string; name: string; type: string; status: string;
                  priority: number; attempts: number; maxAttempts: number; createdAt: string;
                }) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="px-4 py-3 text-white font-medium max-w-xs truncate">{job.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-700/60 text-gray-300">{job.type}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 text-gray-400">{job.priority}</td>
                    <td className="px-4 py-3 text-gray-400">{job.attempts}/{job.maxAttempts}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {['FAILED', 'DEAD', 'CANCELLED'].includes(job.status) && (
                          <button
                            className="btn-ghost p-1.5 text-xs"
                            title="Retry"
                            onClick={() => retryJob.mutate(job.id)}
                          >
                            <RotateCcw size={13} className="text-blue-400" />
                          </button>
                        )}
                        {['PENDING', 'SCHEDULED'].includes(job.status) && (
                          <button
                            className="btn-ghost p-1.5 text-xs"
                            title="Cancel"
                            onClick={() => cancelJob.mutate(job.id)}
                          >
                            <XCircle size={13} className="text-red-400" />
                          </button>
                        )}
                        <button className="btn-ghost p-1.5" title="Details" onClick={() => navigate(`/jobs/${job.id}`)}>
                          <ChevronRight size={13} className="text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 border-t border-gray-800">
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
          </div>
        </div>
      )}

      {/* Dispatch modal */}
      {open && (
        <Modal title="Dispatch Job" onClose={() => { setOpen(false); reset(); }} size="lg">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Job Name *</label>
                <input className="input" placeholder="send-email" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Type</label>
                <select className="input" {...register('type')}>
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Priority</label>
                <input type="number" className="input" {...register('priority')} />
              </div>
              {(jobType === 'DELAYED' || jobType === 'SCHEDULED') && (
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1.5">Run At (ISO datetime)</label>
                  <input type="datetime-local" className="input" {...register('runAt')} />
                </div>
              )}
              {jobType === 'RECURRING' && (
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1.5">Cron Expression</label>
                  <input className="input" placeholder="*/5 * * * *" {...register('cronExpression')} />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Max Attempts</label>
                <input type="number" className="input" defaultValue={3} {...register('maxAttempts')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Idempotency Key</label>
                <input className="input" placeholder="optional unique key" {...register('idempotencyKey')} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Payload (JSON)</label>
                <textarea
                  className="input font-mono text-xs min-h-[100px]"
                  placeholder='{"key": "value"}'
                  {...register('payload')}
                />
              </div>
            </div>
            {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending}>
                {create.isPending && <Loader2 size={14} className="animate-spin" />}
                Dispatch
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
