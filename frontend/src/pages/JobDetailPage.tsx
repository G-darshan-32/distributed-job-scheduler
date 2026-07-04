import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, XCircle, Clock, Cpu, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${jobId}`);
      return data.data;
    },
    refetchInterval: 5000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['job-logs', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${jobId}/logs`);
      return data.data ?? [];
    },
    refetchInterval: 5000,
  });

  const retryJob = useMutation({
    mutationFn: () => api.post(`/queues/${data?.queueId}/jobs/${jobId}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20">
        <AlertCircle size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400">Job not found</p>
        <button className="btn-ghost mt-4" onClick={() => navigate(-1)}><ArrowLeft size={16} />Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button className="btn-ghost p-2 mt-0.5" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white">{data.name}</h1>
            <StatusBadge status={data.status} size="md" />
            <span className="badge bg-gray-700/60 text-gray-300">{data.type}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono">{data.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {['FAILED', 'DEAD', 'CANCELLED'].includes(data.status) && (
            <button className="btn-primary" onClick={() => retryJob.mutate()}>
              <RotateCcw size={14} /> Retry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Details */}
        <div className="card lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2">Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Queue</dt>
              <dd className="text-white font-medium">{data.queue?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Priority</dt>
              <dd className="text-white font-medium">{data.priority}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Attempts</dt>
              <dd className="text-white font-medium">{data.attempts} / {data.maxAttempts}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Worker</dt>
              <dd className="text-white font-medium font-mono text-xs">{data.claimedBy ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd className="text-white">{format(new Date(data.createdAt), 'PPpp')}</dd>
            </div>
            {data.startedAt && (
              <div>
                <dt className="text-gray-500">Started</dt>
                <dd className="text-white">{format(new Date(data.startedAt), 'PPpp')}</dd>
              </div>
            )}
            {data.completedAt && (
              <div>
                <dt className="text-gray-500">Completed</dt>
                <dd className="text-white">{format(new Date(data.completedAt), 'PPpp')}</dd>
              </div>
            )}
            {data.cronExpression && (
              <div>
                <dt className="text-gray-500">Cron</dt>
                <dd className="text-white font-mono">{data.cronExpression}</dd>
              </div>
            )}
          </dl>

          {data.lastError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Last Error</p>
              <p className="text-xs text-red-300 font-mono">{data.lastError}</p>
            </div>
          )}

          {/* Payload */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Payload</h3>
            <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
              {JSON.stringify(data.payload, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {data.result && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Result</h3>
              <pre className="bg-gray-800 rounded-lg p-3 text-xs text-green-300 overflow-x-auto">
                {JSON.stringify(data.result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Execution history */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2 mb-3">
              Execution History
            </h2>
            {data.executions?.length === 0 ? (
              <p className="text-xs text-gray-500">No executions yet</p>
            ) : (
              <div className="space-y-2">
                {data.executions?.map((ex: {
                  id: string; attempt: number; status: string;
                  durationMs?: number; startedAt: string; workerId: string;
                }) => (
                  <div key={ex.id} className="text-xs border border-gray-800 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Attempt #{ex.attempt}</span>
                      <StatusBadge status={ex.status} />
                    </div>
                    {ex.durationMs && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock size={10} />{ex.durationMs}ms
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-gray-600 font-mono truncate">
                      <Cpu size={10} />{ex.workerId.slice(0, 8)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dependency */}
          {data.parentJob && (
            <div className="card">
              <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2 mb-3">Parent Job</h2>
              <div className="text-xs space-y-1">
                <p className="text-white font-medium">{data.parentJob.name}</p>
                <StatusBadge status={data.parentJob.status} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <h2 className="font-semibold text-white text-sm border-b border-gray-800 pb-2 mb-3">
          Execution Logs
        </h2>
        {!logsData || logsData.length === 0 ? (
          <p className="text-xs text-gray-500">No logs yet</p>
        ) : (
          <div className="bg-gray-800 rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
            {logsData.map((log: {
              id: string; level: string; message: string; timestamp: string;
            }) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-gray-600 shrink-0">
                  {format(new Date(log.timestamp), 'HH:mm:ss')}
                </span>
                <span className={
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN' ? 'text-yellow-400' :
                  log.level === 'DEBUG' ? 'text-gray-500' : 'text-gray-300'
                }>
                  [{log.level}]
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
