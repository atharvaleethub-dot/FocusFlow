import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  Plus,
  Sparkles,
  Timer,
} from 'lucide-react';
import AlertsPanel from '../components/alerts/AlertsPanel';
import Button from '../components/common/Button';
import { Card, CardHeader } from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';
import DeadlineList from '../components/dashboard/DeadlineList';
import SessionList from '../components/dashboard/SessionList';
import StatCard from '../components/dashboard/StatCard';
import WeeklyProgressChart from '../components/dashboard/WeeklyProgressChart';
import MissedSessionsBanner from '../components/schedule/MissedSessionsBanner';
import { useAppData } from '../context/AppDataContext';
import { useScheduleReview } from '../context/ScheduleReviewContext';
import { useTaskForm } from '../context/TaskFormContext';
import useScheduleAlerts from '../hooks/useScheduleAlerts';
import { formatDuration, getWeekDateKeys, startOfWeek, toDateKey } from '../utils/dates';
import { getStalePlannedSessions } from '../utils/scheduleStatus';
import {
  getDailyTotals,
  getOverdueTasks,
  getTaskCounts,
  getTodaySessions,
  getUnscheduledTasks,
  getUpcomingDeadlines,
  getUpcomingSessions,
  getWeeklyTotals,
} from '../utils/stats';

function getGreeting(now) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { openTaskForm } = useTaskForm();
  const { openScheduleReview } = useScheduleReview();
  const { tasks, sessions, settings } = useAppData();
  const alerts = useScheduleAlerts();

  const now = new Date();
  const todayKey = toDateKey(now);
  const weekStart = startOfWeek(now, settings.weekStartsOn);
  const weekKeys = getWeekDateKeys(weekStart);

  const totals = getWeeklyTotals(sessions, weekKeys);
  const dailyTotals = getDailyTotals(sessions, weekKeys).map((day) => ({
    ...day,
    isToday: day.dateKey === todayKey,
  }));
  const counts = getTaskCounts(tasks);
  const overdue = getOverdueTasks(tasks, now);
  const unscheduled = getUnscheduledTasks(tasks, sessions, now);
  const attention = [...overdue, ...unscheduled];
  const overdueIds = new Set(overdue.map((task) => task.id));
  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const todaySessions = getTodaySessions(sessions, now);
  const upcomingSessions = getUpcomingSessions(sessions, now, 5);
  const upcomingDeadlines = getUpcomingDeadlines(tasks, now, 5);
  const staleCount = getStalePlannedSessions(sessions, now).length;
  // The missed-session banner already has its own button, so it is left out of the warning list.
  const dashboardAlerts = alerts.filter((item) => item.type !== 'stale');

  const completionPct =
    totals.plannedMinutes > 0
      ? Math.min(100, Math.round((totals.completedMinutes / totals.plannedMinutes) * 100))
      : 0;

  const attentionFlag = (task) =>
    overdueIds.has(task.id)
      ? { label: 'Overdue', tone: 'danger' }
      : { label: 'Unscheduled', tone: 'warning' };

  return (
    <>
      <PageHeader
        title={`${getGreeting(now)}!`}
        description="Here is your study plan at a glance."
        actions={
          <>
            <Button icon={Plus} onClick={() => openTaskForm()}>
              New task
            </Button>
            <Button
              variant="secondary"
              icon={Sparkles}
              onClick={() => openScheduleReview('generate')}
            >
              Generate schedule
            </Button>
            <Button variant="secondary" icon={Timer} href="#/focus">
              Start focus session
            </Button>
          </>
        }
      />

      <MissedSessionsBanner
        count={staleCount}
        onReview={() => openScheduleReview('reschedule')}
      />

      <AlertsPanel alerts={dashboardAlerts} limit={3} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Planned this week"
          value={formatDuration(totals.plannedMinutes)}
          hint={`${totals.sessionCount} session${totals.sessionCount === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Timer}
          label="Completed study time"
          tone="success"
          value={formatDuration(totals.completedMinutes)}
          hint={totals.plannedMinutes > 0 ? `${completionPct}% of planned` : 'No sessions yet'}
        />
        <StatCard
          icon={CheckCircle2}
          label="Tasks completed"
          tone="success"
          value={counts.completed}
          hint={`of ${counts.total} task${counts.total === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={ListChecks}
          label="Tasks remaining"
          tone="warning"
          value={counts.remaining}
          hint={`${overdue.length} overdue`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Today's study sessions" description="Sessions planned for today" />
            {todaySessions.length > 0 ? (
              <SessionList sessions={todaySessions} tasksById={tasksById} />
            ) : (
              <EmptyState
                compact
                icon={CalendarDays}
                title="No sessions planned today"
                description="Planned sessions will appear here once a schedule exists."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Weekly study progress"
              description={`Week of ${weekStart.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}`}
            />
            <WeeklyProgressChart days={dailyTotals} />
          </Card>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader title="Upcoming deadlines" />
            {upcomingDeadlines.length > 0 ? (
              <DeadlineList tasks={upcomingDeadlines} now={now} />
            ) : (
              <EmptyState
                compact
                icon={CalendarClock}
                title="No deadlines yet"
                description="Add tasks with deadlines to see them here."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Upcoming sessions" />
            {upcomingSessions.length > 0 ? (
              <SessionList sessions={upcomingSessions} tasksById={tasksById} showDate />
            ) : (
              <EmptyState
                compact
                icon={Clock}
                title="Nothing scheduled"
                description="Your next sessions will show up here."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Overdue and unscheduled" />
            {attention.length > 0 ? (
              <DeadlineList tasks={attention} now={now} flagFor={attentionFlag} />
            ) : (
              <EmptyState
                compact
                icon={AlertTriangle}
                title="All clear"
                description="No overdue or unscheduled tasks."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}