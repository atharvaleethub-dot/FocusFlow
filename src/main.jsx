import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { AppDataProvider } from './context/AppDataContext.jsx';
import { ScheduleReviewProvider } from './context/ScheduleReviewContext.jsx';
import { TaskFormProvider } from './context/TaskFormContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { TimerProvider } from './context/TimerContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <ThemeProvider>
        <ToastProvider>
          <AppDataProvider>
            <TaskFormProvider>
              <ScheduleReviewProvider>
                <TimerProvider>
                  <App />
                </TimerProvider>
              </ScheduleReviewProvider>
            </TaskFormProvider>
          </AppDataProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);