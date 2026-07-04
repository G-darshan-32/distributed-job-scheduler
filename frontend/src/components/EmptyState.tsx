import { type LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 bg-gray-800 rounded-2xl mb-4">
        <Icon size={32} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-300">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
