import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { STORAGE_KEY } from '../../services/storage';
import Button from './Button';

// FocusFlow keeps one copy of the data per tab. If another tab changes it, this tab is now
// out of date, so it asks for a reload instead of silently overwriting the newer data.
export default function CrossTabNotice() {
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === null || event.key === STORAGE_KEY) setChanged(true);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!changed) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-[65] mx-auto flex max-w-lg flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>FocusFlow was changed in another tab. Reload to see the latest data before editing.</p>
      <Button size="sm" icon={RefreshCw} className="shrink-0" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}