import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Settings,
  Timer,
  TrendingUp,
} from 'lucide-react';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { path: '/tasks', label: 'Tasks', short: 'Tasks', icon: ListChecks },
  { path: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { path: '/focus', label: 'Focus Timer', short: 'Focus', icon: Timer },
  { path: '/analytics', label: 'Analytics', short: 'Stats', icon: TrendingUp },
  { path: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
];