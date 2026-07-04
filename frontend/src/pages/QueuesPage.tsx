import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Plus, Pause, Play, Trash2, BarChart3, ChevronRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  priority: z.coerce.number().default(0),
  concurrencyLimit: z.coerce.number().min(1).max(1000).default(10),
  jobTimeout: z.coerce.number().min(1000).default(300000),
  retryPolicyId: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function QueuesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['queues', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/queues`);
      return data;
    },
    refetchInterval: 15000,
  });

  const { data: policies } = useQuery({
    queryKey: ['retry-policies'],
    queryFn: async () => {
      const { data } = await api.get('/retry-policies');
      return data.data as Array<{ id: string; name: string }>;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const create = useMutation({
    mutationFn: async (body: Form) => api.post(`/projects/${projectId}/queues`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['queues'] }); setOpen(false); reset(); },
  });

  const togglePause = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) =>
      api.post(`/projects/${projectId}/queues/${id}/${paused ? 'resume' : 'pause'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
  });

  const queues = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Queues"
        subtitle="Manage job queues and their configuration"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New Queue</button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : queues.length === 0 ? (
        <EmptyState
          icon={List}
          title="No queues yet"
          description="Create a queue to start dispatching jobs."
          action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Create Queue</button>}
        />
      ) : (
        <div className="space-y-3">
          {queues.map((q: {
            id: string; name: string; description?: string; isPaused: boolean;
            priority: number; concurrencyLimit: number; _count: { jobs: number };
            retryPolicy?: { name: string }
          }) => (
            <div key={q.id} className="card flex items-center gap-4">
              <button
                className="flex-1 flex items-center gap-4 text-left min-w-0"
                onClick={() => navigate(`/queues/${q.id}/jobs`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{q.name}</span>
                    {q.isPaused && <StatusBadge status="IDLE" />}
                    <span className="text-xs text-gray-500">priority: {q.priority}</span>
                  </div>
                  {q.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{q.description}</p>}
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500">concurrency: {q.concurrencyLimit}</span>
                    {q.retryPolicy && <span className="text-xs text-gray-500">retry: {q.retryPolicy.name}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{q._count?.jobs ?? 0}</p>
                  <p className="text-xs text-gray-500">jobs</p>
                </div>
                <ChevronRight size={16} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  className="btn-ghost p-2"
                  onClick={() => togglePause.mutate({ id: q.id, paused: q.isPaused })}
                  title={q.isPaused ? 'Resume' : 'Pause'}
                >
                  {q.isPaused ? <Play size={15} className="text-green-400" /> : <Pause size={15} className="text-yellow-400" />}
                </button>
                <button
                  className="btn-ghost p-2"
                  onClick={() => navigate(`/queues/${q.id}/jobs`)}
                  title="View jobs"
                >
                  <BarChart3 size={15} className="text-blue-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Create Queue" onClose={() => { setOpen(false); reset(); }}>
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
                <input className="input" placeholder="my-queue" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <input className="input" placeholder="Optional..." {...register('description')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Priority</label>
                <input type="number" className="input" defaultValue={0} {...register('priority')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Concurrency Limit</label>
                <input type="number" className="input" defaultValue={10} {...register('concurrencyLimit')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Timeout (ms)</label>
                <input type="number" className="input" defaultValue={300000} {...register('jobTimeout')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Retry Policy</label>
                <select className="input" {...register('retryPolicyId')}>
                  <option value="">None</option>
                  {policies?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending}>
                {create.isPending && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
