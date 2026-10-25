import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { PRIORITIES, PRIORITY_META } from '../../data/schema';
import cn from '../../utils/cn';
import { SORT_OPTIONS, STATUS_OPTIONS } from '../../utils/taskHelpers';
import Button from '../common/Button';
import { Card } from '../common/Card';
import { controlBase, controlOk } from '../common/Field';
import Select from '../common/Select';

export default function TaskFilters({
  filters,
  subjects,
  counts,
  hasActiveFilters,
  onChange,
  onReset,
}) {
  const searchId = useId();

  return (
    <Card padding="p-4" className="space-y-4">
      <div>
        <label htmlFor={searchId} className="sr-only">
          Search tasks
        </label>
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id={searchId}
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search by title, subject, or notes"
            className={cn(controlBase, controlOk, 'h-11 pl-9 sm:h-10')}
          />
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {STATUS_OPTIONS.map((option) => {
          const active = filters.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ status: option.value })}
              className={cn(
                'flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1 text-xs font-medium transition-colors sm:min-h-0 sm:flex-row sm:gap-1.5 sm:py-2 sm:text-sm',
                active
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <span>{option.label}</span>
              <span className="text-[11px] text-slate-400">{counts[option.value]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Select
          label="Subject"
          value={filters.subject}
          onChange={(event) => onChange({ subject: event.target.value })}
        >
          <option value="all">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </Select>

        <Select
          label="Priority"
          value={filters.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_META[priority].label}
            </option>
          ))}
        </Select>

        <Select
          className="col-span-2 lg:col-span-1"
          label="Sort by"
          value={filters.sort}
          onChange={(event) => onChange({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {hasActiveFilters && (
        <div>
          <Button variant="ghost" size="sm" icon={X} onClick={onReset}>
            Reset filters
          </Button>
        </div>
      )}
    </Card>
  );
}