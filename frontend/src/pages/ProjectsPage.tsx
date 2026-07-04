import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, ChevronRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

// For demo, we use the first org. In production, org selection would be separate.
const DEMO_ORG = 'demo-org';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: async () => {
      const { data } = await api.get('/organizations');
      return data.data as Array<{ id: string; name: string; slug: string }>;
    },
  });

  const orgId = orgs?.[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['projects', orgId],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${orgId}/projects`);
      return data;
    },
    enabled: !!orgId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const create = useMutation({
    mutationFn: async (body: Form) => {
      await api.post(`/organizations/${orgId}/projects`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setOpen(false);
      reset();
    },
  });

  const projects = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Organize your job queues into projects"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> New Project
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to start organizing your queues and jobs."
          action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Create Project</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: { id: string; name: string; description?: string; slug: string; _count: { queues: number } }) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}/queues`)}
              className="card text-left hover:border-blue-600/50 hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FolderKanban size={20} className="text-blue-400" />
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="mt-3 font-semibold text-white">{p.name}</h3>
              {p.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.description}</p>}
              <p className="mt-3 text-xs text-gray-500">{p._count?.queues ?? 0} queues</p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Create Project" onClose={() => { setOpen(false); reset(); }}>
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Name</label>
              <input className="input" placeholder="My Project" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description</label>
              <textarea className="input min-h-[80px]" placeholder="Optional description..." {...register('description')} />
            </div>
            {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting || create.isPending}>
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
