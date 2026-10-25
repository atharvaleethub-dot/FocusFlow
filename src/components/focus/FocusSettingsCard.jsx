import { useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useTimer } from '../../context/TimerContext';
import { useToast } from '../../context/ToastContext';
import { focusSettingsToDraft, validateFocusSettings } from '../../utils/focusValidation';
import Button from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import Input from '../common/Input';

export default function FocusSettingsCard() {
  const { settings, updateState } = useAppData();
  const { timer } = useTimer();
  const toast = useToast();

  const [draft, setDraft] = useState(() => focusSettingsToDraft(settings.focus));
  const [errors, setErrors] = useState({});

  const dirty = JSON.stringify(draft) !== JSON.stringify(focusSettingsToDraft(settings.focus));
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  const setField = (name) => (event) => {
    const { value } = event.target;
    setDraft((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = validateFocusSettings(draft);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }
    updateState((previous) => ({
      ...previous,
      settings: { ...previous.settings, focus: result.focus },
    }));
    toast.success(
      'Timer settings saved',
      timerActive ? 'The new lengths apply to your next session.' : 'The new lengths are ready to use.'
    );
  };

  return (
    <Card>
      <CardHeader title="Timer settings" description="Lengths are in minutes." />
      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
        <Input
          label="Focus"
          type="number"
          inputMode="numeric"
          min={1}
          max={180}
          value={draft.focusMinutes}
          onChange={setField('focusMinutes')}
          error={errors.focusMinutes}
        />
        <Input
          label="Short break"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={draft.shortBreakMinutes}
          onChange={setField('shortBreakMinutes')}
          error={errors.shortBreakMinutes}
        />
        <Input
          label="Long break"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          value={draft.longBreakMinutes}
          onChange={setField('longBreakMinutes')}
          error={errors.longBreakMinutes}
        />
        <Input
          label="Sessions before long break"
          type="number"
          inputMode="numeric"
          min={2}
          max={10}
          value={draft.sessionsBeforeLongBreak}
          onChange={setField('sessionsBeforeLongBreak')}
          error={errors.sessionsBeforeLongBreak}
        />
        <div className="col-span-2 flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={!dirty}>
            Save settings
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setDraft(focusSettingsToDraft(settings.focus));
              setErrors({});
            }}
          >
            Discard
          </Button>
        </div>
      </form>
    </Card>
  );
}