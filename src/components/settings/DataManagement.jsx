import { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../context/ToastContext';
import { getStorageInfo, parseBackup } from '../../services/storage';
import Button from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import ConfirmDialog from '../common/ConfirmDialog';
import Modal from '../common/Modal';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function CountTile({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export default function DataManagement() {
  const {
    tasks,
    sessions,
    commitments,
    lastSavedAt,
    replaceAll,
    resetToDemo,
    clearAll,
    exportBackup,
  } = useAppData();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [demoConfirmOpen, setDemoConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const info = useMemo(() => getStorageInfo(), [lastSavedAt]);

  const handleExport = () => {
    exportBackup();
    toast.success('Backup downloaded', 'Check your browser downloads folder.');
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      toast.error('File is too large', 'Backup files must be smaller than 5 MB.');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const result = parseBackup(text);
      if (!result.ok) {
        toast.error('Import failed', result.error);
        return;
      }
      setPendingImport({ fileName: file.name, state: result.state });
    } catch {
      toast.error('Import failed', 'The file could not be read.');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    replaceAll(pendingImport.state);
    setPendingImport(null);
    toast.success('Backup imported', 'Your data was replaced with the backup.');
  };

  const confirmDemo = () => {
    resetToDemo();
    setDemoConfirmOpen(false);
    toast.success('Demo data loaded', 'Your data was replaced with the demo data.');
  };

  const confirmClear = () => {
    clearAll();
    setClearConfirmOpen(false);
    toast.success('All data deleted', 'FocusFlow is empty and ready for your own tasks.');
  };

  return (
    <Card>
      <CardHeader
        title="Data and backup"
        description="Everything is stored in this browser. Export a backup before big changes."
      />

      <div className="grid grid-cols-3 gap-3">
        <CountTile label="Tasks" value={tasks.length} />
        <CountTile label="Sessions" value={sessions.length} />
        <CountTile label="Commitments" value={commitments.length} />
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {info.saved
          ? `Saved in this browser: format v${info.version}, ${info.sizeKb} KB, last saved ${new Date(
              info.savedAt
            ).toLocaleString()}.`
          : 'Nothing has been saved to this browser yet.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={Download} onClick={handleExport}>
          Export backup
        </Button>
        <Button
          variant="secondary"
          icon={Upload}
          loading={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          Import backup
        </Button>
        <Button variant="secondary" icon={RotateCcw} onClick={() => setDemoConfirmOpen(true)}>
          Load demo data
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setClearConfirmOpen(true)}>
          Clear all data
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Choose a FocusFlow backup file"
        />
      </div>

      <Modal
        open={demoConfirmOpen}
        onClose={() => setDemoConfirmOpen(false)}
        title="Load demo data again?"
        description="This replaces all current tasks, sessions, commitments, and settings."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDemoConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDemo}>
              Replace with demo data
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Export a backup first if you want to keep your current data.
        </p>
      </Modal>

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Delete all data?"
        confirmLabel="Delete everything"
        onConfirm={confirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      >
        <p>
          This removes every task, session, commitment, and your schedule history, and resets your
          availability and timer settings. Export a backup first if you might need it.
        </p>
      </ConfirmDialog>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Replace your data with this backup?"
        description="The file passed validation. Importing replaces everything currently saved."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button onClick={confirmImport}>Import backup</Button>
          </>
        }
      >
        {pendingImport && (
          <p className="break-words text-sm text-slate-600 dark:text-slate-300">
            {pendingImport.fileName} contains {pendingImport.state.tasks.length} tasks,{' '}
            {pendingImport.state.sessions.length} sessions, and{' '}
            {pendingImport.state.commitments.length} commitments.
          </p>
        )}
      </Modal>
    </Card>
  );
}