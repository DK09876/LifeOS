import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const TASKS_DB = process.env.NOTION_DATABASE_TASKS!;
const DOMAINS_DB = process.env.NOTION_DATABASE_DOMAINS!;

// Helper functions
function extractText(richText: any[]): string {
  if (!richText || richText.length === 0) return '';
  return richText.map((text: any) => text.plain_text).join('');
}

function extractDate(date: any): Date | null {
  if (!date || !date.start) return null;
  return new Date(date.start);
}

function extractSelect(select: any): string | null {
  if (!select || !select.name) return null;
  return select.name;
}

async function migrateDomains() {
  console.log('📦 Migrating Domains from Notion...');

  const response = await notion.dataSources.query({
    data_source_id: DOMAINS_DB,
  });

  const domainMap = new Map<string, string>(); // Notion ID -> Prisma ID

  for (const page of response.results) {
    const props = (page as any).properties;

    const domain = await prisma.domain.create({
      data: {
        domain: extractText(props.Domain?.title || []),
        domainPriority: extractSelect(props['Domain Priority']?.select) || '3 - Maintenance',
      },
    });

    domainMap.set(page.id, domain.id);
    console.log(`  ✓ Migrated domain: ${domain.domain}`);
  }

  return domainMap;
}

async function migrateTasks(domainMap: Map<string, string>) {
  console.log('\n📋 Migrating Tasks from Notion...');

  const response = await notion.dataSources.query({
    data_source_id: TASKS_DB,
    sorts: [
      {
        property: 'Task Score',
        direction: 'descending',
      },
    ],
  });

  let count = 0;

  for (const page of response.results) {
    const props = (page as any).properties;

    // Get domain relation
    const domainRelation = props.Domain?.relation?.[0];
    const domainId = domainRelation ? domainMap.get(domainRelation.id) : undefined;

    // Extract action points
    const actionPointsStr = extractSelect(props['Action Points']?.select);
    const actionPoints = actionPointsStr ? parseInt(actionPointsStr) : null;

    await prisma.task.create({
      data: {
        taskName: extractText(props['Task Name']?.title || []),
        status: extractSelect(props.Status?.select) || 'Backlog',
        taskPriority: extractSelect(props['Task Priority']?.select) || '3 - Normal',
        dueDate: extractDate(props['Due Date']?.date),
        plannedDate: extractDate(props['Planned Date']?.date),
        recurrence: extractSelect(props.Recurrence?.select) || 'None',
        lastCompleted: extractDate(props['Last Completed']?.date),
        actionPoints,
        notes: extractText(props.Notes?.rich_text || []),
        domainId,
      },
    });

    count++;
    console.log(`  ✓ Migrated task #${count}`);
  }

  console.log(`\n✅ Migration complete! Migrated ${count} tasks and ${domainMap.size} domains.`);
}

async function main() {
  try {
    console.log('🚀 Starting migration from Notion to local database...\n');

    const domainMap = await migrateDomains();
    await migrateTasks(domainMap);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
