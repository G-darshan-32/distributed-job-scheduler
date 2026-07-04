import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

export default function Modal({ title, onClose, children, size = 'md' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`card w-full ${sizes[size]} shadow-2xl`}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
