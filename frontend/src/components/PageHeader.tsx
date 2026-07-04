interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex items-start justify-between px-6 pt-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
