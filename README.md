# LifeOS

A modern, local-first Progressive Web App for personal productivity and task management. Your data stays on your device and syncs across all your devices via your own Google Drive.

## Features

### Local-First Architecture
- **Works Offline**: Full functionality even without internet
- **Your Data, Your Control**: Data stored locally in IndexedDB on each device
- **Google Drive Sync**: Sync across devices using your own Google Drive account
- **No Central Server**: No third-party database - you own all your data

### Task Management
- **Smart Priority Scoring**: Automatic task scoring based on priority, domain importance, and due dates
- **Multiple Views**: View all tasks, today's tasks, or this week's tasks
- **Status Filtering**: Filter by active, done, or all tasks
- **Recurring Tasks**: Support for daily, weekly, biweekly, monthly, quarterly, and yearly recurring tasks with automatic reset functionality
- **Action Points**: Gamification with action point system

### Domain Organization
- **Priority Levels**: Critical, Important, or Maintenance categorization
- **Task Tracking**: See how many tasks are associated with each domain
- **Visual Indicators**: Color-coded priority levels for quick identification

### Progressive Web App
- **Installable**: Add to home screen on iOS, Android, Windows, and macOS
- **Offline Support**: Works without internet using cached data
- **Auto Sync**: Syncs on app startup and with manual refresh button

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS 4
- **Language**: TypeScript 5
- **Local Database**: Dexie.js (IndexedDB)
- **Sync**: Google Drive API
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 20+ installed
- A Google account (for cross-device sync)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/DK09876/LifeOS.git
cd LifeOS
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up Google OAuth for cross-device sync:

   a. Go to [Google Cloud Console](https://console.cloud.google.com/)
   b. Create a new project or select an existing one
   c. Enable the Google Drive API
   d. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
   e. Select "Web application"
   f. Add your domains to Authorized JavaScript origins:
      - `http://localhost:3000` (for development)
      - Your production domain
   g. Copy the Client ID

4. Create a `.env.local` file:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
LifeOS/
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout with PWA config
│   └── globals.css       # Global styles
├── components/
│   ├── TaskCard.tsx      # Task display component
│   ├── DomainCard.tsx    # Domain display component
│   └── ServiceWorkerRegistration.tsx  # PWA service worker
├── lib/
│   ├── db.ts             # Dexie database schema & operations
│   ├── hooks.ts          # React hooks for data access
│   ├── google-auth.ts    # Google OAuth authentication
│   └── sync.ts           # Google Drive sync service
├── types/
│   └── index.ts          # TypeScript type definitions
├── public/
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service worker
│   └── icons/            # App icons
└── .env.local            # Environment variables (not committed)
```

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Device                            │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │  React UI   │────▶│  IndexedDB  │────▶│  Sync Engine │  │
│  │             │◀────│  (Local DB) │◀────│              │  │
│  └─────────────┘     └─────────────┘     └──────┬───────┘  │
└─────────────────────────────────────────────────┼──────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │   Your Google Drive     │
                                    │   (lifeos-data.json)    │
                                    └─────────────────────────┘
```

1. **Local Storage**: All data is stored in IndexedDB on your device
2. **Instant Updates**: Changes are saved locally immediately
3. **Background Sync**: Data syncs to Google Drive in the background
4. **Cross-Device**: Other devices pull updates from Google Drive

### Sync Behavior

- **On App Open**: Automatically fetches from Google Drive and merges with local data
- **Manual Refresh**: Click "Sync" button to force sync
- **Conflict Resolution**: Last-write-wins based on timestamps

## Usage

### Installing as an App

| Platform | How to Install |
|----------|----------------|
| **iOS Safari** | Share button → "Add to Home Screen" |
| **Android Chrome** | Menu → "Install app" or automatic prompt |
| **Windows/Mac Chrome** | URL bar install icon or Menu → "Install" |
| **Windows/Mac Edge** | URL bar install icon |

### Using Without Google Sign-In

The app works fully offline without Google sign-in. Your data is stored locally and persists across browser sessions. Sign in with Google only when you want to sync across multiple devices.

### Task Actions

- **Mark Done**: Complete a task and record the completion time
- **Undo**: Revert a completed task back to backlog
- **Reset**: Reset a recurring task (appears for completed recurring tasks)

### Understanding Task Scores

Task scores are automatically calculated based on:
- Task Priority (1-Urgent to 5-Optional)
- Domain Priority (Critical, Important, Maintenance)
- Due Date proximity (overdue, today, this week, etc.)

Higher scores indicate more urgent/important tasks.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID | No (only for sync) |

## Privacy

- **No Server Required**: LifeOS runs entirely in your browser
- **Your Data, Your Drive**: Data syncs only to your personal Google Drive
- **No Analytics**: No tracking or data collection
- **Open Source**: Full transparency into what the code does

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Local database powered by [Dexie.js](https://dexie.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
