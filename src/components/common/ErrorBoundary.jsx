import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { STORAGE_KEY } from '../../services/storage';
import { TIMER_KEY } from '../../services/timerStorage';
import cn from '../../utils/cn';
import Button from './Button';

// Catches render errors so a bug shows a recovery screen instead of a blank page.
// It must not depend on any context, because the contexts may be what failed.
export default class ErrorBoundary extends Component {
  state = { error: null, confirmingErase: false };

  static getDerivedStateFromError(error) {
    return { error, confirmingErase: false };
  }

  componentDidCatch(error, info) {
    console.error('FocusFlow hit an unexpected error:', error, info.componentStack);
  }

  downloadSavedData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'focusflow-saved-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Nothing more can be done if browser storage is blocked.
    }
  };

  eraseAndReload = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TIMER_KEY);
    } catch {
      // Ignore: the reload below still restarts the app.
    }
    window.location.reload();
  };

  render() {
    const { error, confirmingErase } = this.state;
    const { children, fullScreen = false } = this.props;
    if (!error) return children;

    const Heading = fullScreen ? 'h1' : 'h2';

    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center px-4 py-10 text-center',
          fullScreen ? 'min-h-screen' : 'min-h-[50vh]'
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle size={24} aria-hidden="true" />
        </span>
        <Heading className="mt-4 text-xl font-bold">Something went wrong</Heading>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          FocusFlow hit an unexpected error. Your saved data is still in this browser.
        </p>
        <p className="mt-3 max-w-md break-words rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {String(error.message || error)}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="secondary" onClick={this.downloadSavedData}>
            Download saved data
          </Button>
        </div>

        <div className="mt-6">
          {confirmingErase ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-rose-700 dark:text-rose-300">
                This deletes every task, session, and setting stored in this browser.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => this.setState({ confirmingErase: false })}
                >
                  Cancel
                </Button>
                <Button variant="danger" onClick={this.eraseAndReload}>
                  Erase everything
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => this.setState({ confirmingErase: true })}>
              Erase saved data and restart
            </Button>
          )}
        </div>
      </div>
    );
  }
}