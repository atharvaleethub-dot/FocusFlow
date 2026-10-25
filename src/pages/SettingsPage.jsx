import AvailabilitySettings from '../components/settings/AvailabilitySettings';
import CommitmentsSettings from '../components/settings/CommitmentsSettings';
import DataManagement from '../components/settings/DataManagement';
import { Card, CardHeader } from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import Select from '../components/common/Select';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { availability } = useAppData();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Set your study availability and fixed commitments, plus appearance and data."
      />

      <div className="space-y-4 sm:space-y-6">
        {/* The key resets the draft form whenever saved availability changes (save, import, demo reload). */}
        <AvailabilitySettings key={JSON.stringify(availability)} />
        <CommitmentsSettings />

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Appearance" description="Choose how FocusFlow looks." />
            <Select
              label="Theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Card>

          <DataManagement />
        </div>
      </div>
    </>
  );
}