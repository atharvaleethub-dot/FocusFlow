# FocusFlow — Adaptive Study Planner

FocusFlow turns a list of study tasks into a realistic weekly schedule, and rearranges unfinished sessions when plans change. It respects your study hours, fixed commitments, daily limits, and deadlines, and it tells you honestly when there is not enough time.

**Live demo:** _add your deployed URL here_

Everything runs in the browser. There is no backend, no account, and no API key: your data stays in your browser's Local Storage.

## Features

### Planning
- **Tasks** with subject, notes, estimated duration, deadline, priority (Low, Medium, High, Urgent), progress, and completion. Search, filter by status, subject, and priority, and sort by deadline, priority, remaining time, title, or date added.
- **Intelligent scheduling engine** that places study sessions into free time, splits long tasks into sessions, and respects deadlines, daily limits, minimum breaks, and fixed commitments.
- **Generate and reschedule with a preview.** Review new, removed, and missed sessions before anything is saved. Tasks that cannot fit are listed with a clear reason, and the app never claims success when work is left unscheduled.
- **Missed-session rescheduling** that replans only the unfinished time. Completed sessions and recorded study time are never changed.
- **Locked sessions** that automatic scheduling never moves.

### Calendar
- Weekly calendar with week navigation, a current-day and current-time indicator, study-window shading, and fixed commitments shown as protected time.
- Mobile-friendly agenda view.
- Create, edit, delete, and inspect sessions, with validation against overlaps, commitments, and deadlines.
- **Drag and drop** with live green, amber, and red feedback, plus a keyboard alternative (Shift + arrow keys) and Edit-based moving on touch devices.

### Focus timer
- Start, pause, resume, finish early, and reset, with configurable focus, short-break, and long-break lengths.
- Timestamp-based, so it stays accurate in background tabs and survives page changes and refreshes. A header chip shows the countdown on every page.
- Records actual study time, completes the matching planned session when there is one, and updates task progress and analytics. Repeated clicks cannot create duplicate records.

### Insights
- Dashboard with today's sessions, weekly progress, upcoming deadlines and sessions, and overdue or unscheduled work.
- Analytics: total, weekly, daily, and 8-week study activity, completed vs planned vs missed sessions, task completion rate, progress by subject, and rescheduled sessions.
- Warnings for overdue tasks, approaching deadlines, not enough time, unscheduled work, conflicts, and sessions that ended without being completed.

### Safety and reliability
- **Schedule history and undo** for generated schedules and manual calendar changes (the last 20 changes). Undo never erases recorded study time.
- Versioned Local Storage with validation, recovery from corrupted data, JSON backup export and validated import, demo data, and clear-all.
- Error screen with data-recovery options, and a notice when another browser tab changes your data.

### Design and accessibility
- Responsive layouts for phones, tablets, laptops, and large screens, with light and dark themes.
- Keyboard navigation, visible focus, a skip link, focus management on navigation, dialog focus trapping, labelled controls, reduced-motion support, and readable contrast.

## How the scheduler works

The engine is a set of pure, tested functions in `src/services/scheduler.js` with no React code in it.

1. Planned sessions that have already ended become *missed*, and their time is replanned.
2. Future planned sessions are validated. Valid ones are kept, invalid ones are removed, and locked or manually placed sessions are protected.
3. Remaining work for each task is its estimate minus studied time minus time already covered by kept sessions.
4. Tasks are ordered by an *effective deadline*: the real deadline moved earlier for urgent and high priority work (48 h and 24 h) and later for low priority work (12 h). Near deadlines are never ignored in favor of far urgent ones.
5. Each task is placed into the earliest free slots: inside your study window, outside fixed commitments, with the minimum break between sessions, within the daily limit, and before the deadline. No more than two preferred-length sessions of one task are planned per day unless that is needed to fit.
6. Anything that does not fit is reported with a reason: no availability, not enough free time before the deadline, time used by tasks planned first, or a deadline beyond the planning window.

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React (functional components and hooks), JavaScript (ES2020+) |
| Build tool | Vite |
| Styling | Tailwind CSS v3, PostCSS, Autoprefixer |
| Icons | lucide-react |
| Storage | Browser Local Storage (versioned and validated) |
| Tests | Vitest |
| Hosting | Any static host (Vercel instructions below) |

## Getting started

Requirements: a current Node.js LTS (20.19+ or 22.12+) and npm.

```powershell
git clone https://github.com/<your-username>/FocusFlow.git
cd FocusFlow
npm install
npm run dev
```

Then open the address Vite prints (normally http://localhost:5173).

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the development server |
| `npm run build` | Creates the production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs the unit tests once |
| `npm run test:watch` | Runs the tests in watch mode |
| `npm run lint` | Checks the code with ESLint |

## Project structure

```text
FocusFlow/
├── public/                  Favicon
├── docs/screenshots/        README screenshots
├── src/
│   ├── components/          UI, grouped by area
│   │   ├── alerts/ analytics/ calendar/ common/ dashboard/
│   │   └── focus/ history/ layout/ schedule/ settings/ tasks/
│   ├── context/             Theme, toasts, app data, task form, schedule review, timer
│   ├── data/                Data model (schema.js) and demo data
│   ├── hooks/               Reusable hooks
│   ├── pages/               Dashboard, Tasks, Calendar, Focus, Analytics, Settings
│   ├── services/            Scheduler, storage, validation, history, timer engine, state actions
│   ├── utils/               Dates, statistics, analytics, alerts, validation, scheduling helpers
│   ├── tests/               Unit tests
│   ├── App.jsx  main.jsx  index.css
├── index.html  vite.config.js  tailwind.config.js  postcss.config.js
└── package.json  README.md  LICENSE
```

## Data and privacy

All data is stored under the `focusflow:*` keys of your browser's Local Storage. Nothing is sent to a server. Data belongs to one browser and one web address, so use **Settings > Data and backup > Export backup** and **Import backup** to move it between devices or addresses. Clearing your browser data deletes your FocusFlow data.

## Testing

```powershell
npm test
```

The unit tests cover date handling (local time, no UTC shifts), time intervals, conflict detection, the scheduling engine (priorities, deadlines, daily limits, commitments, splitting, impossible and overloaded scenarios, rescheduling, locked sessions, determinism), task and session actions, session moves, history and undo, the focus timer state machine and recording, analytics, warnings, Local Storage recovery, backup validation, and form validation.

## Screenshots

Add screenshots to `docs/screenshots/` and uncomment the lines below. Suggested shots (about 1400 px wide for desktop, 390 px wide for mobile):

- `dashboard.png`: Dashboard with demo data
- `calendar.png`: Week view with sessions and commitments
- `schedule-preview.png`: Generate schedule preview dialog
- `analytics.png`: Analytics page
- `focus-timer.png`: Focus timer mid-session
- `mobile-agenda.png`: Calendar agenda on a phone
- `dark-mode.png`: Dashboard in the dark theme

<!--
![Dashboard](docs/screenshots/dashboard.png)
![Calendar](docs/screenshots/calendar.png)
![Schedule preview](docs/screenshots/schedule-preview.png)
![Analytics](docs/screenshots/analytics.png)
![Focus timer](docs/screenshots/focus-timer.png)
![Mobile agenda](docs/screenshots/mobile-agenda.png)
![Dark mode](docs/screenshots/dark-mode.png)
-->

## Deployment

FocusFlow is a static site, so it needs no server, environment variables, or rewrite rules (pages use `#/` addresses).

On Vercel: import the GitHub repository, keep the detected **Vite** preset (build command `npm run build`, output directory `dist`), and click **Deploy**. Every push to the main branch redeploys automatically.

## Design decisions

- **Hash-based navigation** avoids a routing dependency and server rewrites.
- **Business logic lives outside components.** Scheduling, validation, storage, history, and the timer are plain modules that are unit tested.
- **A timer based on timestamps** rather than a counter keeps time correct when the tab is in the background.
- **Previews before changes.** Schedule changes are shown first, and every change can be undone.
- **No heavy dependencies.** Charts, drag and drop, dialogs, and routing are built with plain React, SVG, and native browser features.

## Known limitations

- Data is not synced between devices. Use backups to move it.
- Drag and drop works with a mouse or trackpad. Touch and keyboard users move sessions with Edit or Shift + arrow keys.
- A focus timer that ended more than 2 minutes before the app was reopened is discarded rather than recorded.
- Undo reverses schedule and calendar changes, not task edits.

## License

Released under the MIT License. See [LICENSE](LICENSE).