import { clsx } from 'clsx';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  SCHEDULED: 'bg-purple-500/20 text-purple-400',
  CLAIMED: 'bg-blue-500/20 text-blue-400',
  RUNNING: 'bg-blue-600/30 text-blue-300 animate-pulse',
  COMPLETED: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-gray-500/20 text-gray-400',
  DEAD: 'bg-red-900/40 text-red-300',
  // Worker statuses
  ACTIVE: 'bg-green-500/20 text-green-400',
  IDLE: 'bg-gray-500/20 text-gray-400',
  DRAINING: 'bg-orange-500/20 text-orange-400',
  OFFLINE: 'bg-red-500/20 text-red-400',
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  return (
    <span
      className={clsx(
        'badge',
        statusColors[status] ?? 'bg-gray-700 text-gray-300',
        size === 'md' && 'text-sm px-3 py-1'
      )}
    >
      {status}
    </span>
  );
}
