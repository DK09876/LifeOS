# Life OS 👾

A modern web application that brings your Notion LifeOS workspace to life with a beautiful, intuitive interface for managing tasks and domains.

## Features

### Task Management
- **Smart Priority Scoring**: Automatic task scoring based on priority, domain importance, and due dates
- **Multiple Views**: View all tasks, today's tasks, or this week's tasks
- **Status Filtering**: Filter by active, done, or all tasks
- **Recurring Tasks**: Support for daily, weekly, biweekly, monthly, quarterly, and yearly recurring tasks with automatic reset functionality
- **Action Points**: Gamification with 1-10 action point system
- **Quick Actions**: Mark tasks as done, undo completion, or reset recurring tasks

### Domain Organization
- **Priority Levels**: Critical, Important, or Maintenance categorization
- **Task Tracking**: See how many tasks are associated with each domain
- **Visual Indicators**: Color-coded priority levels for quick identification

### Real-time Sync
- Direct integration with your Notion workspace
- All changes sync immediately with Notion
- Click "Open" to view tasks directly in Notion

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Integration**: Notion API (@notionhq/client)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 20+ installed
- A Notion workspace with the LifeOS template
- Notion integration token with access to your workspace

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

3. Create a `.env.local` file in the root directory:
```env
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_TASKS=your_tasks_database_id
NOTION_DATABASE_DOMAINS=your_domains_database_id
NOTION_PAGE_LIFEOS=your_lifeos_page_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
LifeOS/
├── app/
│   ├── api/           # API routes for Notion integration
│   ├── page.tsx       # Main application page
│   └── layout.tsx     # Root layout
├── components/
│   ├── TaskCard.tsx   # Task display component
│   └── DomainCard.tsx # Domain display component
├── lib/
│   └── notion.ts      # Notion API integration layer
├── types/
│   └── notion.ts      # TypeScript type definitions
└── .env.local         # Environment variables (not committed)
```

## Usage

### Viewing Tasks

- **All Tasks**: View all tasks sorted by priority score
- **Today**: See tasks due today
- **This Week**: View tasks due in the next 7 days

### Filtering Tasks

- **Active**: Show only incomplete tasks
- **Done**: Show only completed tasks
- **All**: Show all tasks regardless of status

### Task Actions

- **Mark Done**: Complete a task and record the completion time
- **Undo**: Revert a completed task back to backlog
- **Reset**: Reset a recurring task (appears for completed recurring tasks)
- **Open**: View the task directly in Notion

### Understanding Task Scores

Task scores are automatically calculated based on:
- Task Priority (1-Urgent to 5-Optional)
- Domain Priority (Critical, Important, Maintenance)
- Due Date proximity (overdue, today, this week, etc.)

Higher scores indicate more urgent/important tasks.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NOTION_TOKEN` | Your Notion integration token | `ntn_...` |
| `NOTION_DATABASE_TASKS` | Tasks database ID | `2d151c40...` |
| `NOTION_DATABASE_DOMAINS` | Domains database ID | `2d151c40...` |
| `NOTION_PAGE_LIFEOS` | LifeOS page ID | `2d151c40...` |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Notion API](https://developers.notion.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
