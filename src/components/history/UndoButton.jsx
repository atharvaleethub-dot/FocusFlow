import { Undo2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import useHistory from '../../hooks/useHistory';
import Button from '../common/Button';

export default function UndoButton({ variant = 'secondary', size = 'md' }) {
  const { latest, undo } = useHistory();
  const toast = useToast();

  const handleUndo = () => {
    const result = undo();
    if (result.undone) toast.success('Change undone', result.undone.label);
  };

  const label = latest ? `Undo: ${latest.label}` : 'Nothing to undo';

  return (
    <Button
      variant={variant}
      size={size}
      icon={Undo2}
      disabled={!latest}
      onClick={handleUndo}
      title={label}
      aria-label={label}
    >
      Undo
    </Button>
  );
}