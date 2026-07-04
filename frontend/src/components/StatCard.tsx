import { type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  trend?: string;
}

const colors = {
  blue: 'text-blue-400 bg-blue-500/10',
  green: 'text-green-400 bg-green-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  red: 'text-red-400 bg-red-500/10',
  purple: 'text-purple-400 bg-purple-500/10',
};

export default function StatCard({ label, value, icon: Icon, color = 'blue', trend }: Props) {
  return (
    <div className="card flex items-center gap-4">
      <div className={clsx('p-3 rounded-xl', colors[color])}>
        <Icon size={22} className={colors[color].split(' ')[0]} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {trend && <p className="text-xs text-gray-500 mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
