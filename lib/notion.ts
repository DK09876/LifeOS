import { Client } from '@notionhq/client';
import { Task, Domain } from '@/types/notion';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const TASKS_DB = process.env.NOTION_DATABASE_TASKS!;
const DOMAINS_DB = process.env.NOTION_DATABASE_DOMAINS!;

// Helper to extract text from Notion rich text
function extractText(richText: any[]): string {
  if (!richText || richText.length === 0) return '';
  return richText.map((text: any) => text.plain_text).join('');
}

// Helper to extract date
function extractDate(date: any): string | null {
  if (!date || !date.start) return null;
  return date.start;
}

// Helper to extract select value
function extractSelect(select: any): string | null {
  if (!select || !select.name) return null;
  return select.name;
}

// Fetch all domains
export async function getDomains(): Promise<Domain[]> {
  const response = await notion.dataSources.query({
    data_source_id: DOMAINS_DB,
  });

  return response.results.map((page: any) => {
    const props = page.properties;
    return {
      id: page.id,
      domain: extractText(props.Domain?.title || []),
      domainPriority: extractSelect(props['Domain Priority']?.select) || '3 - Maintenance',
      taskCount: props.Tasks?.relation?.length || 0,
      url: page.url,
    } as Domain;
  });
}

// Fetch all tasks
export async function getTasks(filter?: any): Promise<Task[]> {
  const queryOptions: any = {
    data_source_id: TASKS_DB,
    sorts: [
      {
        property: 'Task Score',
        direction: 'descending',
      },
    ],
  };

  if (filter) {
    queryOptions.filter = filter;
  }

  const response = await notion.dataSources.query(queryOptions);

  return response.results.map((page: any) => {
    const props = page.properties;

    return {
      id: page.id,
      taskName: extractText(props['Task Name']?.title || []),
      status: extractSelect(props.Status?.select) || 'Backlog',
      taskPriority: extractSelect(props['Task Priority']?.select) || '3 - Normal',
      taskScore: props['Task Score']?.formula?.number || 0,
      dueDate: extractDate(props['Due Date']?.date),
      plannedDate: extractDate(props['Planned Date']?.date),
      recurrence: extractSelect(props.Recurrence?.select) || 'None',
      lastCompleted: extractDate(props['Last Completed']?.date),
      needsReset: props['Needs Reset']?.formula?.boolean || false,
      actionPoints: extractSelect(props['Action Points']?.select),
      notes: extractText(props.Notes?.rich_text || []),
      domain: null, // Will be populated separately if needed
      domainPriority: props['Domain Priority']?.rollup?.array?.[0]?.select?.name || null,
      url: page.url,
    } as Task;
  });
}

// Get tasks due today
export async function getTasksDueToday(): Promise<Task[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  return getTasks({
    and: [
      {
        property: 'Due Date',
        date: {
          equals: todayStr,
        },
      },
      {
        property: 'Status',
        select: {
          does_not_equal: 'Done',
        },
      },
      {
        property: 'Status',
        select: {
          does_not_equal: 'Archived',
        },
      },
    ],
  });
}

// Get tasks due this week
export async function getTasksDueThisWeek(): Promise<Task[]> {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  return getTasks({
    and: [
      {
        property: 'Due Date',
        date: {
          on_or_after: today.toISOString().split('T')[0],
        },
      },
      {
        property: 'Due Date',
        date: {
          on_or_before: nextWeek.toISOString().split('T')[0],
        },
      },
      {
        property: 'Status',
        select: {
          does_not_equal: 'Done',
        },
      },
      {
        property: 'Status',
        select: {
          does_not_equal: 'Archived',
        },
      },
    ],
  });
}

// Mark task as done
export async function markTaskDone(taskId: string): Promise<void> {
  const now = new Date().toISOString();

  await notion.pages.update({
    page_id: taskId,
    properties: {
      Status: {
        select: {
          name: 'Done',
        },
      },
      'Last Completed': {
        date: {
          start: now,
        },
      },
    },
  });
}

// Undo task done
export async function undoTaskDone(taskId: string): Promise<void> {
  await notion.pages.update({
    page_id: taskId,
    properties: {
      Status: {
        select: {
          name: 'Backlog',
        },
      },
    },
  });
}

// Reset recurring task
export async function resetTask(taskId: string): Promise<void> {
  await notion.pages.update({
    page_id: taskId,
    properties: {
      Status: {
        select: {
          name: 'Backlog',
        },
      },
      'Last Completed': {
        date: null,
      },
    },
  });
}

// Create a new task
export async function createTask(task: Partial<Task>): Promise<void> {
  const properties: any = {
    'Task Name': {
      title: [
        {
          text: {
            content: task.taskName || 'New Task',
          },
        },
      ],
    },
  };

  if (task.status) {
    properties.Status = {
      select: {
        name: task.status,
      },
    };
  }

  if (task.taskPriority) {
    properties['Task Priority'] = {
      select: {
        name: task.taskPriority,
      },
    };
  }

  if (task.dueDate) {
    properties['Due Date'] = {
      date: {
        start: task.dueDate,
      },
    };
  }

  if (task.recurrence && task.recurrence !== 'None') {
    properties.Recurrence = {
      select: {
        name: task.recurrence,
      },
    };
  }

  if (task.actionPoints) {
    properties['Action Points'] = {
      select: {
        name: task.actionPoints,
      },
    };
  }

  if (task.notes) {
    properties.Notes = {
      rich_text: [
        {
          text: {
            content: task.notes,
          },
        },
      ],
    };
  }

  await notion.pages.create({
    parent: {
      data_source_id: TASKS_DB,
    },
    properties,
  });
}

// Update a task
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const properties: any = {};

  if (updates.taskName) {
    properties['Task Name'] = {
      title: [
        {
          text: {
            content: updates.taskName,
          },
        },
      ],
    };
  }

  if (updates.status) {
    properties.Status = {
      select: {
        name: updates.status,
      },
    };
  }

  if (updates.taskPriority) {
    properties['Task Priority'] = {
      select: {
        name: updates.taskPriority,
      },
    };
  }

  if (updates.dueDate !== undefined) {
    properties['Due Date'] = updates.dueDate
      ? {
          date: {
            start: updates.dueDate,
          },
        }
      : { date: null };
  }

  if (updates.notes !== undefined) {
    properties.Notes = updates.notes
      ? {
          rich_text: [
            {
              text: {
                content: updates.notes,
              },
            },
          ],
        }
      : { rich_text: [] };
  }

  await notion.pages.update({
    page_id: taskId,
    properties,
  });
}
