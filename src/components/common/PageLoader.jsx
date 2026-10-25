import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400"
    >
      <Loader2 size={28} className="animate-spin" aria-hidden="true" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}