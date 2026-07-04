import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

export default function Pagination({ page, totalPages, total, onPage }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-gray-400">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost px-2 py-1 disabled:opacity-30"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-gray-300">
          {page} / {totalPages}
        </span>
        <button
          className="btn-ghost px-2 py-1 disabled:opacity-30"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
