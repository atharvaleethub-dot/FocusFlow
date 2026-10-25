import cn from '../../utils/cn';
import { formatDuration } from '../../utils/dates';

// data: [{ key, label, sublabel?, ariaLabel?, primary, secondary, highlight? }] (minutes)
export default function BarChart({
  data,
  caption,
  primaryLabel = 'Studied',
  secondaryLabel = 'Planned',
  minColumnWidth = 30,
}) {
  const maxMinutes = Math.max(60, ...data.map((item) => Math.max(item.primary, item.secondary)));
  const barHeight = (minutes) =>
    minutes > 0 ? `${Math.max(3, Math.round((minutes / maxMinutes) * 100))}%` : '0%';

  return (
    <div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{primaryLabel}</th>
            <th>{secondaryLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.key}>
              <td>{item.ariaLabel ?? item.label}</td>
              <td>{formatDuration(item.primary)}</td>
              <td>{formatDuration(item.secondary)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true" className="flex gap-2">
        <div className="flex h-40 w-10 shrink-0 flex-col justify-between text-right text-[10px] text-slate-400">
          <span>{formatDuration(maxMinutes)}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex gap-1" style={{ minWidth: data.length * minColumnWidth }}>
            {data.map((item) => (
              <div
                key={item.key}
                title={`${item.ariaLabel ?? item.label}: ${formatDuration(
                  item.primary
                )} ${primaryLabel.toLowerCase()}, ${formatDuration(
                  item.secondary
                )} ${secondaryLabel.toLowerCase()}`}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <div className="flex h-40 w-full items-end justify-center gap-0.5 border-b border-slate-200 dark:border-slate-700">
                  <div
                    className="w-2 rounded-t bg-brand-200 dark:bg-brand-500/30 sm:w-3"
                    style={{ height: barHeight(item.secondary) }}
                  />
                  <div
                    className="w-2 rounded-t bg-brand-600 sm:w-3"
                    style={{ height: barHeight(item.primary) }}
                  />
                </div>
                <p
                  className={cn(
                    'mt-1 text-[11px] font-medium',
                    item.highlight
                      ? 'font-bold text-brand-600 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {item.label}
                </p>
                {item.sublabel && <p className="text-[10px] text-slate-400">{item.sublabel}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
          {primaryLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-200 dark:bg-brand-500/30" />
          {secondaryLabel}
        </span>
      </div>
    </div>
  );
}