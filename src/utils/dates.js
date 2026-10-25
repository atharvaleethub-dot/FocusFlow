// All helpers work with LOCAL dates and times. Nothing here converts calendar
// dates through UTC, so dates never shift by a day.

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // index = Date.getDay()
export const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
export const WEEKDAY_SHORT = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (value) => String(value).padStart(2, '0');

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  if (typeof key !== 'string') return null;
  const match = DATE_KEY_RE.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Reject overflow such as 2026-02-31.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isValidDateKey(key) {
  return parseDateKey(key) !== null;
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function timeToMinutes(time) {
  if (typeof time !== 'string') return null;
  const match = TIME_RE.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function minutesToTime(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function parseLocalDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = DATETIME_RE.exec(value);
  if (!match) return null;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isValidLocalDateTime(value) {
  return parseLocalDateTime(value) !== null;
}

export function formatLocalDateTime(date) {
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineDateAndTime(dateKey, time) {
  const date = parseDateKey(dateKey);
  const minutes = timeToMinutes(time);
  if (!date || minutes === null) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60
  );
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, amount) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
    date.getHours(),
    date.getMinutes()
  );
}

export function startOfWeek(date, weekStartsOn = 1) {
  const day = startOfDay(date);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function getWeekDateKeys(weekStart) {
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index)));
}

export function getWeekdayKey(dateKey) {
  const date = parseDateKey(dateKey);
  return date ? WEEKDAY_KEYS[date.getDay()] : null;
}

export function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes || 0));
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimeLabel(time) {
  const total = timeToMinutes(time);
  if (total === null) return String(time);
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad(minutes)} ${suffix}`;
}

export function formatTimeRange(start, end) {
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

export function formatDateLabel(dateKey, now = new Date()) {
  const date = parseDateKey(dateKey);
  if (!date) return String(dateKey);
  const diff = Math.round((date - startOfDay(now)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDeadline(value, now = new Date()) {
  const date = parseLocalDateTime(value);
  if (!date) return String(value);
  const time = minutesToTime(date.getHours() * 60 + date.getMinutes());
  return `${formatDateLabel(toDateKey(date), now)}, ${formatTimeLabel(time)}`;
}