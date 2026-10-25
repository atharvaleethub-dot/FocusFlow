import { Suspense, lazy, useEffect, useRef } from 'react';
import CrossTabNotice from './components/common/CrossTabNotice';
import ErrorBoundary from './components/common/ErrorBoundary';
import PageLoader from './components/common/PageLoader';
import AppLayout from './components/layout/AppLayout';
import useHashRoute from './hooks/useHashRoute';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const FocusPage = lazy(() => import('./pages/FocusPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const routes = {
  '/dashboard': { title: 'Dashboard', Page: DashboardPage },
  '/tasks': { title: 'Tasks', Page: TasksPage },
  '/calendar': { title: 'Calendar', Page: CalendarPage },
  '/focus': { title: 'Focus Timer', Page: FocusPage },
  '/analytics': { title: 'Analytics', Page: AnalyticsPage },
  '/settings': { title: 'Settings', Page: SettingsPage },
};

export default function App() {
  const route = useHashRoute();
  const current = routes[route];
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!current) {
      window.location.replace('#/dashboard');
      return;
    }
    document.title = `${current.title} | FocusFlow`;
    window.scrollTo(0, 0);

    // After the first load, move focus to the new page so keyboard and screen-reader users
    // start at the top of the content instead of staying on the link they clicked.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [route, current]);

  if (!current) return null;

  const { Page } = current;

  return (
    <>
      <CrossTabNotice />
      <AppLayout route={route}>
        <p role="status" aria-live="polite" className="sr-only">
          {current.title} page
        </p>
        <ErrorBoundary key={route}>
          <Suspense fallback={<PageLoader />}>
            <Page />
          </Suspense>
        </ErrorBoundary>
      </AppLayout>
    </>
  );
}