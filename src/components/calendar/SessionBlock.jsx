import { AlertTriangle, Check, Lock, X } from 'lucide-react';
import cn from '../../utils/cn';
import { formatTimeRange } from '../../utils/dates';
import { SESSION_STYLES } from './sessionStyles';

// Shift + arrow keys move a session: up/down by 15 minutes, left/right by one day.
const KEY_MOVES = {
  ArrowUp: { minutes: -15 },
  ArrowDown: { minutes: 15 },
  ArrowLeft: { days: -1 },
  ArrowRight: { days: 1 },
};

export default function SessionBlock({
  session,
  title,
  style,
  conflict,
  compact,
  draggable = false,
  dragging = false,
  onSelect,
  onDragStart,
  onDragEnd,
  onMoveByKey,
}) {
  const styles = SESSION_STYLES[session.status];
  const range = formatTimeRange(session.start, session.end);

  const handleKeyDown = (event) => {
    if (!onMoveByKey || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    onMoveByKey(session, move);
  };

  // The draggable wrapper is a div because buttons cannot be drag sources in Firefox.
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (event) => onDragStart(event, session) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      style={style}
      className={cn('absolute inset-x-1 z-10 focus-within:z-20', dragging && 'opacity-40')}
    >
      <button
        type="button"
        data-session-id={session.id}
        onClick={() => onSelect(session.id)}
        onKeyDown={handleKeyDown}
        aria-keyshortcuts={
          onMoveByKey
            ? 'Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight'
            : undefined
        }
        aria-label={`${title}, ${range}, ${styles.label}${session.locked ? ', locked' : ''}${
          conflict ? ', conflicts with a fixed commitment' : ''
        }`}
        className={cn(
          'h-full w-full overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:shadow-md',
          draggable && 'cursor-grab active:cursor-grabbing',
          styles.block,
          conflict && 'ring-2 ring-rose-500'
        )}
      >
        <span className="flex items-start gap-1">
          <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
          {session.status === 'completed' && (
            <Check size={12} aria-hidden="true" className="shrink-0" />
          )}
          {session.status === 'missed' && <X size={12} aria-hidden="true" className="shrink-0" />}
          {session.locked && <Lock size={12} aria-hidden="true" className="shrink-0" />}
          {conflict && <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />}
        </span>
        {!compact && <span className="block truncate opacity-80">{range}</span>}
      </button>
    </div>
  );
}