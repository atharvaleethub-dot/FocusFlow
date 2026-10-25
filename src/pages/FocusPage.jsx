import FocusSettingsCard from '../components/focus/FocusSettingsCard';
import TimerPanel from '../components/focus/TimerPanel';
import TodayFocusCard from '../components/focus/TodayFocusCard';
import PageHeader from '../components/common/PageHeader';
import { useAppData } from '../context/AppDataContext';

export default function FocusPage() {
  const { settings } = useAppData();

  return (
    <>
      <PageHeader
        title="Focus Timer"
        description="Stay on task and record your real study time."
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <TimerPanel />
        </div>
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <TodayFocusCard />
          {/* The key resets the draft form whenever the saved settings change. */}
          <FocusSettingsCard key={JSON.stringify(settings.focus)} />
        </div>
      </div>
    </>
  );
}