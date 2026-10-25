import {
  WEEKDAY_KEYS,
  WEEKDAY_ORDER,
  addDays,
  combineDateAndTime,
  formatLocalDateTime,
  parseLocalDateTime,
  startOfDay,
  timeToMinutes,
  toDateKey,
} from '../utils/dates';
import {
  createCommitment,
  createSession,
  createTask,
  defaultAvailability,
  defaultSettings,
} from './schema';

// dayOffset is relative to today, so the demo always looks current.
const taskSpecs = [
  {
    key: 'chem',
    title: 'Organic chemistry quiz prep',
    subject: 'Chemistry',
    notes: 'Focus on reaction mechanisms and nomenclature.',
    estimatedMinutes: 120,
    priority: 'urgent',
    dayOffset: 2,
    time: '09:00',
  },
  {
    key: 'calculus',
    title: 'Calculus problem set 5',
    subject: 'Mathematics',
    notes: 'Integration by parts and series.',
    estimatedMinutes: 180,
    priority: 'high',
    dayOffset: 4,
    time: '23:59',
  },
  {
    key: 'physics',
    title: 'Physics lab report',
    subject: 'Physics',
    notes: 'Write up results and error analysis.',
    estimatedMinutes: 150,
    priority: 'high',
    dayOffset: 6,
    time: '18:00',
  },
  {
    key: 'lit',
    title: 'Read Hamlet, acts 3-5',
    subject: 'Literature',
    notes: '',
    estimatedMinutes: 120,
    priority: 'medium',
    dayOffset: 7,
    time: '20:00',
  },
  {
    key: 'cs',
    title: 'Data structures assignment',
    subject: 'Computer Science',
    notes: 'Linked lists and binary trees.',
    estimatedMinutes: 240,
    priority: 'medium',
    dayOffset: 9,
    time: '23:59',
  },
  {
    key: 'history',
    title: 'History essay outline',
    subject: 'History',
    notes: '',
    estimatedMinutes: 90,
    priority: 'low',
    dayOffset: 11,
    time: '12:00',
  },
  {
    key: 'stats',
    title: 'Statistics worksheet',
    subject: 'Mathematics',
    notes: 'Overdue demo task.',
    estimatedMinutes: 60,
    priority: 'high',
    dayOffset: -1,
    time: '18:00',
  },
  {
    key: 'flash',
    title: 'Vocabulary flashcards',
    subject: 'Literature',
    notes: '',
    estimatedMinutes: 45,
    priority: 'low',
    dayOffset: -2,
    time: '12:00',
    completed: true,
  },
];

// [start, end, taskKey] per weekday. Slots respect the default availability
// and the demo commitments (classes, gym, dinner).
const slotPattern = {
  mon: [
    ['16:00', '17:00', 'calculus'],
    ['17:15', '18:15', 'physics'],
  ],
  tue: [
    ['15:30', '16:30', 'chem'],
    ['18:15', '19:15', 'cs'],
  ],
  wed: [
    ['16:00', '17:00', 'lit'],
    ['17:15', '18:15', 'calculus'],
  ],
  thu: [
    ['15:30', '16:30', 'chem'],
    ['18:15', '19:15', 'physics'],
  ],
  fri: [['16:00', '17:30', 'cs']],
  sat: [
    ['10:00', '11:30', 'calculus'],
    ['11:45', '12:45', 'cs'],
  ],
  sun: [['10:00', '11:00', 'lit']],
};

function deadlineAt(today, dayOffset, time) {
  const [hours, minutes] = time.split(':').map(Number);
  const day = addDays(today, dayOffset);
  return formatLocalDateTime(
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
  );
}

export function createDemoData(now = new Date()) {
  const today = startOfDay(now);
  const tenDaysAgo = addDays(today, -10).getTime();

  const tasks = taskSpecs.map((spec, index) =>
    createTask({
      id: `demo-task-${spec.key}`,
      title: spec.title,
      subject: spec.subject,
      notes: spec.notes,
      estimatedMinutes: spec.estimatedMinutes,
      priority: spec.priority,
      deadline: deadlineAt(today, spec.dayOffset, spec.time),
      createdAt: new Date(tenDaysAgo + index * 3600000).toISOString(),
      completed: Boolean(spec.completed),
    })
  );
  const tasksByKey = Object.fromEntries(taskSpecs.map((spec, index) => [spec.key, tasks[index]]));

  const sessions = [];
  let sessionCounter = 0;
  let pastCounter = 0;
  let lockedAssigned = false;
  const nextSessionId = () => {
    sessionCounter += 1;
    return `demo-session-${sessionCounter}`;
  };

  for (let offset = -7; offset <= 6; offset += 1) {
    const date = addDays(today, offset);
    const dateKey = toDateKey(date);
    const slots = slotPattern[WEEKDAY_KEYS[date.getDay()]] || [];

    slots.forEach(([start, end, taskKey]) => {
      const task = tasksByKey[taskKey];
      const sessionEnd = combineDateAndTime(dateKey, end);
      // Never place study time after a task's deadline.
      if (sessionEnd > parseLocalDateTime(task.deadline)) return;

      let status = 'planned';
      let actualMinutes = null;
      let completedAt = null;
      let locked = false;

      if (offset < 0) {
        pastCounter += 1;
        if (pastCounter % 5 === 0) {
          status = 'missed';
        } else {
          status = 'completed';
          actualMinutes = timeToMinutes(end) - timeToMinutes(start);
          completedAt = sessionEnd.toISOString();
        }
      } else if (taskKey === 'chem' && !lockedAssigned) {
        locked = true;
        lockedAssigned = true;
      }

      sessions.push(
        createSession({
          id: nextSessionId(),
          taskId: task.id,
          date: dateKey,
          start,
          end,
          status,
          locked,
          source: 'auto',
          actualMinutes,
          completedAt,
        })
      );
    });
  }

  // The completed demo task gets one recorded study session on a recent weekday evening.
  for (let offset = -1; offset >= -7; offset -= 1) {
    const date = addDays(today, offset);
    const weekday = WEEKDAY_KEYS[date.getDay()];
    if (weekday === 'sat' || weekday === 'sun') continue;
    const dateKey = toDateKey(date);
    const finishedAt = combineDateAndTime(dateKey, '21:00').toISOString();
    sessions.push(
      createSession({
        id: nextSessionId(),
        taskId: tasksByKey.flash.id,
        date: dateKey,
        start: '20:15',
        end: '21:00',
        status: 'completed',
        source: 'manual',
        actualMinutes: 45,
        completedAt: finishedAt,
      })
    );
    tasksByKey.flash.completedAt = finishedAt;
    break;
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  const commitments = [
    createCommitment({
      id: 'demo-commitment-college',
      title: 'College lectures',
      category: 'class',
      repeat: 'weekly',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      start: '08:30',
      end: '15:00',
    }),
    createCommitment({
      id: 'demo-commitment-gym',
      title: 'Gym',
      category: 'other',
      repeat: 'weekly',
      days: ['tue', 'thu'],
      start: '17:00',
      end: '18:00',
    }),
    createCommitment({
      id: 'demo-commitment-dinner',
      title: 'Dinner',
      category: 'meal',
      repeat: 'weekly',
      days: [...WEEKDAY_ORDER],
      start: '19:30',
      end: '20:15',
    }),
  ];

  return {
    tasks,
    sessions,
    commitments,
    availability: defaultAvailability(),
    settings: defaultSettings(),
    history: [],
  };
}