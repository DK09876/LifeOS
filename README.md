# LifeOS

A modern, local-first Progressive Web App for personal productivity and task management. Your data stays on your device — no account required.

**Live App: [my-lifeos.vercel.app](https://my-lifeos.vercel.app)**

## Quick Start

1. Visit **[my-lifeos.vercel.app](https://my-lifeos.vercel.app)**
2. Create your first **Domain** (life area like Work, Health, Finance)
3. Add **Tasks** and assign them to domains
4. Use **Today** and **Week** views to focus on what matters
5. Check the **How it Works** page in the sidebar for detailed guidance

That's it! Your data is saved automatically in your browser.

## Features

### Local-First Architecture
- **Works Offline**: Full functionality even without internet
- **No Account Required**: Start using immediately, no sign-up
- **Your Data, Your Device**: Data stored locally in your browser's IndexedDB
- **Privacy First**: No server, no tracking, no data collection

### Pages

| Page | Description |
|------|-------------|
| **Today** | Tasks due or planned for today with completion stats |
| **Week** | Calendar view of your week, navigate between weeks |
| **Plan** | Triage tasks needing attention, manage your backlog |
| **Tasks** | Full database with sorting, filtering, and search |
| **Domains** | Manage life areas (Work, Health, Finance, etc.) |
| **How it Works** | In-app guide explaining features and workflow |

### Task Management
- **Smart Priority Scoring**: Automatic scoring based on priority, domain, and due date
- **Multiple Statuses**: Needs Details, Backlog, Blocked, Done, Archived
- **Recurring Tasks**: Daily, weekly, biweekly, monthly, quarterly, yearly
- **Planned Dates**: Schedule tasks for specific days

### Domain Organization
- **Priority Levels**: Critical, Important, or Maintenance
- **Icons**: Emoji icons for quick visual identification
- **Task Tracking**: See task counts per domain

### Progressive Web App
- **Installable**: Add to home screen on iOS, Android, Windows, macOS
- **Offline Support**: Works without internet
- **Daily Quotes**: Inspirational quotes from ZenQuotes API

## How Task Score Works

Tasks are automatically scored to help you prioritize:

```
Score = Task Priority + Domain Priority + Due Date Urgency
```

| Factor | Values |
|--------|--------|
| Task Priority | Urgent (50), High (40), Normal (30), Low (20), Optional (10) |
| Domain Priority | Critical (30), Important (20), Maintenance (10) |
| Due Date | Overdue (+25), Today (+20), Within 7 days (+15), Within 30 days (+10) |

Higher score = more urgent. Range: 20-105.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS 4
- **Language**: TypeScript 5
- **Local Database**: Dexie.js (IndexedDB)
- **Date Handling**: date-fns

## Running Locally

### Prerequisites
- Node.js 20+

### Installation

```bash
git clone https://github.com/DK09876/LifeOS.git
cd LifeOS
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
LifeOS/
├── app/
│   ├── page.tsx          # Today view
│   ├── week/page.tsx     # Week calendar view
│   ├── plan/page.tsx     # Planning & triage
│   ├── tasks/page.tsx    # Tasks database
│   ├── domains/page.tsx  # Domains database
│   ├── help/page.tsx     # How it Works guide
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Dark theme styles
├── components/
│   ├── AppLayout.tsx     # Main layout with sidebar
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── Modal.tsx         # Reusable modal
│   ├── TaskForm.tsx      # Task create/edit form
│   ├── DomainForm.tsx    # Domain create/edit form
│   └── ConfirmDialog.tsx # Delete confirmation
├── lib/
│   ├── db.ts             # Dexie database & scoring
│   ├── hooks.ts          # React hooks for data
│   ├── quotes.ts         # Daily quote fetching
│   ├── google-auth.ts    # Google OAuth (coming soon)
│   └── sync.ts           # Google Drive sync (coming soon)
├── types/
│   └── index.ts          # TypeScript types
└── public/
    ├── manifest.json     # PWA manifest
    ├── sw.js             # Service worker
    └── icons/            # App icons
```

## Installing as an App

| Platform | How to Install |
|----------|----------------|
| **iOS Safari** | Share button → "Add to Home Screen" |
| **Android Chrome** | Menu → "Install app" |
| **Desktop Chrome** | URL bar install icon → "Install" |

## Privacy

- **No Server**: Runs entirely in your browser
- **No Account**: No sign-up or login required
- **No Tracking**: Zero analytics or data collection
- **Open Source**: Full code transparency

## Roadmap

- [ ] Google Drive sync for cross-device access
- [ ] Data export/import
- [ ] Custom themes
- [ ] Keyboard shortcuts

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.
