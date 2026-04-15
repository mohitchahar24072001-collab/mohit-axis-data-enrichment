type Status = 'pending' | 'enriching' | 'enriched' | 'failed';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const statusConfig: Record<Status, { label: string; classes: string; dot: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
  enriching: {
    label: 'Enriching',
    classes: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
  },
  enriched: {
    label: 'Enriched',
    classes: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.classes} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
