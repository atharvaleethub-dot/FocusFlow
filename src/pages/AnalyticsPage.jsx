import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Timer, XCircle } from 'lucide-react';
import AlertsPanel from '../components/alerts/AlertsPanel';
import BarChart from '../components/analytics/BarChart';
import SessionBreakdown from '../components/analytics/SessionBreakdown';
import SubjectProgress from '../components/analytics/SubjectProgress';
import { Card, CardHeader } from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';
import DeadlineList from '../components/dashboard/DeadlineList';
import StatCard from '../components/dashboard/StatCard';
import HistoryCard from '../components/history/HistoryCard';
import { useAppData } from '../context/AppDataContext';
import useScheduleAlerts from '../hooks/useScheduleAlerts';
import cn from '../utils/cn';
import {
  formatDuration,
  getWeekDateKeys,
  parseDateKey,
  startOfWeek,
} from '../utils/dates';
import {
  getCompletionStats,
  getDailyActivity,
  getSessionCounts,
  getSubjectProgress,
  getTotalStudiedMinutes,
  getWeeklyActivity,
} from '../utils/analytics';
import { getOverdueTasks, getUpcomingDeadlines, getWeeklyTotals } from '../utils/stats';

const RANGES = [7, 14, 30];

export default function AnalyticsPage() {
  const { tasks, sessions, settings } = useAppData();
  const alerts = useScheduleAlerts();
  const [range, setRange] = useState(14);

  const now = new Date();
  const weekTotals = getWeeklyTotals(
    sessions,
    getWeekDateKeys(startOfWeek(now, settings.weekStartsOn))
  );
  const completion = getCompletionStats(tasks);
  const counts = getSessionCounts(sessions, now);
  const overdue = getOverdueTasks(tasks, now);
  const upcoming = getUpcomingDeadlines(tasks, now, 5);
  const subjects = getSubjectProgress(tasks, sessions);

  const daily = getDailyActivity(sessions, now, range).map((day) => {
    const date = parseDateKey(day.dateKey);
    return {
      key: day.dateKey,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      sublabel: String(date.getDate()),
      ariaLabel: date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      primary: day.completedMinutes,
      secondary: day.plannedMinutes,
      highlight: day.isToday,
    };
  });

  const weekly = getWeeklyActivity(sessions, now, settings.weekStartsOn, 8).map((week) => {
    const date = parseDateKey(week.weekStartKey);
    const label = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return {
      key: week.weekStartKey,
      label,
      ariaLabel: `Week of ${label}`,
      primary: week.completedMinutes,
      secondary: week.plannedMinutes,
      highlight: week.isCurrent,
    };
  });

  return (
    <>
      <PageHeader title="Analytics" description="Understand how your study time is spent." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Timer}
          label="Total study time"
          value={formatDuration(getTotalStudiedMinutes(sessions))}
          hint="All recorded sessions"
        />
        <StatCard
          icon={Clock}
          label="Studied this week"
          tone="success"
          value={formatDuration(weekTotals.completedMinutes)}
          hint={`${formatDuration(weekTotals.plannedMinutes)} planned`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Task completion"
          tone="success"
          value={completion.rate === null ? '—' : `${Math.round(completion.rate * 100)}%`}
          hint={`${completion.completed} of ${completion.total} tasks`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue tasks"
          tone="danger"
          value={overdue.length}
          hint="Need attention"
        />
        <StatCard
          icon={XCircle}
          label="Missed sessions"
          tone="warning"
          value={counts.missed}
          hint={`${formatDuration(counts.missedMinutes)} to replan`}
        />
        <StatCard
          icon={RotateCcw}
          label="Rescheduled"
          value={counts.rescheduled}
          hint="Moved or replanned"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Daily activity"
            description="Studied vs planned minutes per day"
            action={
              <div
                role="group"
                aria-label="Daily activity range"
                className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
              >
                {RANGES.map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={range === days}
                    onClick={() => setRange(days)}
                    className={cn(
                      'min-h-[36px] rounded-md px-2.5 text-xs font-medium transition-colors',
                      range === days
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            }
          />
          <BarChart
            data={daily}
            caption={`Study activity for the last ${range} days`}
            minColumnWidth={range > 14 ? 26 : 30}
          />
        </Card>

        <Card>
          <CardHeader title="Weekly activity" description="Studied vs planned minutes, last 8 weeks" />
          <BarChart
            data={weekly}
            caption="Study activity for the last 8 weeks"
            minColumnWidth={40}
          />
        </Card>

        <Card>
          <CardHeader title="Sessions" description="Completed, planned, and missed" />
          <SessionBreakdown counts={counts} />
        </Card>

        <Card>
          <CardHeader title="Progress by subject" description="Studied time against your estimates" />
          <SubjectProgress subjects={subjects} />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Time recorded on deleted tasks counts toward total study time only.
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Deadline warnings"
            description="Overdue work, approaching deadlines, capacity, and conflicts"
          />
          <AlertsPanel
            alerts={alerts}
            emptyText="Deadlines, capacity, and your calendar all look fine."
          />
        </Card>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader title="Upcoming deadlines" />
            {upcoming.length > 0 ? (
              <DeadlineList tasks={upcoming} now={now} />
            ) : (
              <EmptyState compact title="No upcoming deadlines" />
            )}
          </Card>

          <Card>
            <CardHeader title="Overdue tasks" />
            {overdue.length > 0 ? (
              <DeadlineList tasks={overdue} now={now} />
            ) : (
              <EmptyState compact title="Nothing overdue" />
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        <HistoryCard />
      </div>
    </>
  );
}