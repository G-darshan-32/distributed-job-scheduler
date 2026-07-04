import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';

const STRATEGIES = ['FIXED', 'LINEAR', 'EXPONENTIAL'] as const;

const schema = z.object({
  name: z.string().min(1).max(100),
  strategy: z.enum(STRATEGIES).default('EXPONENTIAL'),
  maxAttempts: z.coerce.number().min(1).max(100).default(3),
  baseDelayMs: z.coerce.number().min(100).default(1000),
  maxDelayMs: z.coerce.number().min(100).default(3600000),
  multiplier: z.coerce.number().min(1).max(10).default(2),
});
type Form = z.infer<typeof schema>;

type Policy = Form & { id: string; createdAt: string };

export default function RetryPoliciesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['retry-policies'],
    queryFn: async () => {
      const { data } = await api.get('/retry-policies');
      return data.data as Policy[];
    },
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { strategy: 'EXPONENTIAL', maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 3600000, multiplier: 2 },
  });

  const openCreate = () => { setEditing(null); reset(); setOpen(true); };
  const openEdit = (p: Policy) => {
    setEditing(p);
    Object.entries(p).forEach(([k, v]) => setValue(k as keyof Form, v as string & number));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (body: Form) => {
      if (editing) await api.patch(`/retry-policies/${editing.id}`, body);
      else await api.post('/retry-policies', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retry-policies'] }); setOpen(false); reset(); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/retry-policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['retry-policies'] }),
  });

  const policies = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Retry Policies"
        subtitle="Configure reusable retry strategies for your queues"
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} />New Policy</button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : policies.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No retry policies"
          description="Create a retry policy and attach it to a queue."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} />Create Policy</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  <span className="badge bg-blue-500/20 text-blue-400 mt-1">{p.strategy}</span>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost p-1.5" onClick={() => openEdit(p)} aria-label="Edit policy">
                    <Pencil size={13} className="text-gray-400" />
                  </button>
                  <button className="btn-ghost p-1.5" onClick={() => remove.mutate(p.id)} aria-label="Delete policy">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-gray-500">Max Attempts</dt><dd className="text-white font-medium">{p.maxAttempts}</dd></div>
                <div><dt className="text-gray-500">Base Delay</dt><dd className="text-white font-medium">{p.baseDelayMs}ms</dd></div>
                <div><dt className="text-gray-500">Max Delay</dt><dd className="text-white font-medium">{(p.maxDelayMs / 1000).toFixed(0)}s</dd></div>
                <div><dt className="text-gray-500">Multiplier</dt><dd className="text-white font-medium">{p.multiplier}x</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title={editing ? 'Edit Policy' : 'Create Retry Policy'} onClose={() => { setOpen(false); reset(); setEditing(null); }}>
          <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
              <input className="input" placeholder="Exponential Backoff" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Strategy</label>
              <select className="input" {...register('strategy')}>
                {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Max Attempts</label>
                <input type="number" className="input" {...register('maxAttempts')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Multiplier</label>
                <input type="number" step="0.1" className="input" {...register('multiplier')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Base Delay (ms)</label>
                <input type="number" className="input" {...register('baseDelayMs')} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Max Delay (ms)</label>
                <input type="number" className="input" {...register('maxDelayMs')} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); reset(); setEditing(null); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
