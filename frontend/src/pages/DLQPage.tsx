import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skull, RotateCcw, Trash2, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Pagination from '../components/Pagination';

export default function DLQPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['dlq', page],
    queryFn: async () => {
      const { data } = await api.get('/dlq', { params: { page, limit: 15 } });
      return data;
    },
    refetchInterval: 30000,
  });

  const replay = useMutation({
    mutationFn: (id: string) => api.post(`/dlq/${id}/replay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dlq'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/dlq/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dlq'] }),
  });

  const generateSummary = async (id: string) => {
    setAiLoading(id);
    try {
      const { data } = await api.post(`/dlq/${id}/ai-summary`);
      setAiSummaries((prev) => ({ ...prev, [id]: data.data.summary }));
    } catch {
      setAiSummaries((prev) => ({ ...prev, [id]: 'Unable to generate summary.' }));
    } finally {
      setAiLoading(null);
    }
  };

  const entries = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dead Letter Queue"
        subtitle="Jobs that exhausted all retry attempts"
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Skull}
          title="No dead letter entries"
          description="All jobs are running healthy. Dead jobs will appear here."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry: {
            id: string; reason: string; lastError: string; attempts: number;
            failedAt: string; replayedAt?: string; replayJobId?: string;
            aiSummary?: string;
            job: { id: string; name: string; queue: { name: string } };
            payload: unknown;
          }) => (
            <div key={entry.id} className="card">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg mt-0.5 flex-shrink-0">
                  <Skull size={16} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-white">{entry.job?.name ?? 'Unknown Job'}</span>
                    <span className="badge bg-gray-700/50 text-gray-400">
                      {entry.job?.queue?.name ?? '—'}
                    </span>
                    <span className="text-xs text-gray-500">{entry.attempts} attempts</span>
                    {entry.replayedAt && (
                      <span className="badge bg-blue-500/20 text-blue-400">Replayed</span>
                    )}
                  </div>
                  <p className="text-xs text-red-400 mt-1 font-mono line-clamp-2">{entry.lastError}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Failed {formatDistanceToNow(new Date(entry.failedAt), { addSuffix: true })} · {format(new Date(entry.failedAt), 'PPpp')}
                  </p>

                  {/* AI Summary */}
                  {(entry.aiSummary || aiSummaries[entry.id]) && (
                    <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
                      <p className="text-xs font-semibold text-purple-400 mb-1 flex items-center gap-1">
                        <Sparkles size={11} /> AI Analysis
                      </p>
                      <p className="text-xs text-purple-200">
                        {entry.aiSummary || aiSummaries[entry.id]}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="btn-ghost p-2"
                    title="Generate AI summary"
                    onClick={() => generateSummary(entry.id)}
                    disabled={aiLoading === entry.id}
                    aria-label="Generate AI failure summary"
                  >
                    {aiLoading === entry.id
                      ? <Loader2 size={14} className="animate-spin text-purple-400" />
                      : <Sparkles size={14} className="text-purple-400" />
                    }
                  </button>
                  <button
                    className="btn-ghost p-2"
                    title="Replay job"
                    onClick={() => replay.mutate(entry.id)}
                    disabled={replay.isPending}
                    aria-label="Replay job"
                  >
                    <RotateCcw size={14} className="text-blue-400" />
                  </button>
                  <button
                    className="btn-ghost p-2"
                    title="Delete entry"
                    onClick={() => remove.mutate(entry.id)}
                    disabled={remove.isPending}
                    aria-label="Delete DLQ entry"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                  <button
                    className="btn-ghost p-2"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    aria-label="Toggle payload"
                    aria-expanded={expanded === entry.id}
                  >
                    {expanded === entry.id
                      ? <ChevronUp size={14} className="text-gray-400" />
                      : <ChevronDown size={14} className="text-gray-400" />
                    }
                  </button>
                </div>
              </div>

              {expanded === entry.id && (
                <div className="mt-3 border-t border-gray-800 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Payload</p>
                  <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}

          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
