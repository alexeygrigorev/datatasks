#!/usr/bin/env node

/**
 * Migration script: imports data from Trello board export and CSV spreadsheets
 * into the DataTasks application (persistent LevelDB via dynalite).
 *
 * Prerequisites:
 *   Stop the dev server first (LevelDB only allows one process at a time).
 *
 * Usage:
 *   IS_LOCAL=true tsx scripts/migrate-data.ts [--dry-run] [--templates-only] [--csv-only] [--cards-only]
 *
 * Flags:
 *   --dry-run         Print what would be imported without writing to DB
 *   --templates-only  Only import Trello templates
 *   --csv-only        Only import CSV tasks
 *   --cards-only      Only import active Trello cards as projects+tasks
 *   --include-done    Also import done CSV tasks (skipped by default)
 *
 * Data sources:
 *   data/qVB6fAUG - datatalksclub.json   Trello board export
 *   data/TODO list - todo.csv            Open tasks
 *   data/TODO list - done.csv            Completed tasks
 */

import fs from 'fs';
import path from 'path';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { getClient, startLocal } from '../src/db/client';
import { createTables } from '../src/db/setup';
import { createTemplate, listTemplates } from '../src/db/templates';
import { createProject } from '../src/db/projects';
import { createTask } from '../src/db/tasks';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TEMPLATES_ONLY = args.includes('--templates-only');
const CSV_ONLY = args.includes('--csv-only');
const CARDS_ONLY = args.includes('--cards-only');
const INCLUDE_DONE = args.includes('--include-done');

// If no specific flag, import everything
const IMPORT_ALL = !TEMPLATES_ONLY && !CSV_ONLY && !CARDS_ONLY;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRELLO_FILE = path.join(DATA_DIR, 'qVB6fAUG - datatalksclub.json');
const CSV_TODO_FILE = path.join(DATA_DIR, 'TODO list - todo.csv');
const CSV_DONE_FILE = path.join(DATA_DIR, 'TODO list - done.csv');

// ---------------------------------------------------------------------------
// CSV parser (simple, handles quoted fields with newlines)
// ---------------------------------------------------------------------------

function parseCSVFile(filePath: string): string[][] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const results: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(current);
      if (row.length > 0) results.push(row);
      row = [];
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip CR
    } else {
      current += ch;
    }
  }
  // last field
  if (current || row.length > 0) {
    row.push(current);
    results.push(row);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Date parsing helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Try to parse various date formats into YYYY-MM-DD.
 */
function parseDate(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // DD Mon YYYY or DD MMM YYYY
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (dmy) {
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Trello template -> App template mapping
// ---------------------------------------------------------------------------

interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  due?: string;
  closed: boolean;
  isTemplate: boolean;
  idList: string;
  idChecklists: string[];
  labels: { name: string }[];
  attachments: { name?: string; url: string }[];
  dateLastActivity?: string;
}

interface TrelloChecklist {
  id: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

interface TrelloCheckItem {
  name: string;
  pos: number;
  state: string;
  due?: string;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

function mapTemplateType(cardName: string, labels: { name: string }[]): string {
  const name = cardName.toLowerCase();
  if (name.includes('[newsletter]')) return 'newsletter';
  if (name.includes('[podcast]')) return 'podcast';
  if (name.includes('[webinar]')) return 'webinar';
  if (name.includes('[workshop]')) return 'workshop';
  if (name.includes('[book of the week]')) return 'book-of-the-week';
  if (name.includes('[open-source spotlight]')) return 'oss';
  if (name.includes('[course]')) return 'course';
  if (name.includes('[social media]')) return 'social-media';
  if (name.includes('[maven ll]')) return 'maven-ll';
  if (name.includes('[office hours]')) return 'office-hours';
  if (name.includes('tax report')) return 'tax-report';
  if (name.includes('invoice')) return 'invoice';

  // Fallback: use first label
  if (labels && labels.length > 0) {
    return labels[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  return 'other';
}

function trelloTemplateToAppTemplate(card: TrelloCard, boardChecklists: TrelloChecklist[]) {
  const cardChecklists = (card.idChecklists || [])
    .map((clId) => boardChecklists.find((cl) => cl.id === clId))
    .filter((cl): cl is TrelloChecklist => Boolean(cl))
    .sort((a, b) => a.pos - b.pos);

  const taskDefinitions: { refId: string; description: string; offsetDays: number; instructionsUrl?: string }[] = [];
  let totalItems = 0;

  for (const cl of cardChecklists) {
    totalItems += (cl.checkItems || []).length;
  }

  let itemIndex = 0;
  for (const cl of cardChecklists) {
    const items = (cl.checkItems || []).sort((a, b) => a.pos - b.pos);
    for (const item of items) {
      const offsetDays = totalItems > 1
        ? Math.round(-totalItems + itemIndex * (totalItems + 5) / (totalItems - 1))
        : 0;

      const { description: cleanedName, instructionsUrl } = extractInstructionsUrl(item.name);
      const refId = slugify(`${cl.name}-${cleanedName}`.substring(0, 60));

      const td: { refId: string; description: string; offsetDays: number; instructionsUrl?: string } = {
        refId: `${refId}-${itemIndex}`,
        description: `[${cl.name}] ${cleanedName}`,
        offsetDays,
      };
      if (instructionsUrl) td.instructionsUrl = instructionsUrl;
      taskDefinitions.push(td);
      itemIndex++;
    }
  }

  return {
    name: cleanTemplateName(card.name),
    type: mapTemplateType(card.name, card.labels),
    taskDefinitions,
  };
}

function cleanTemplateName(name: string): string {
  return name
    .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+\s*/u, '')
    .replace(/\s*#XXX\b/, '')
    .replace(/\s*\(DD MMM \d{4}\)/, '')
    .replace(/\s*2026-MMM-DD\s*-\s*Topic\s*-\s*(?:Name|Speaker)/, '')
    .replace(/\s*2026-MM-DD\s*-\s*Topic\s*-\s*(?:Name|Speaker|Alexey Grigorev)/, '')
    .replace(/\s*YYYY-MM-DD\s*-\s*Book\s*-\s*Author\(s\)/, '')
    .replace(/\s*-\s*Tool\s*-\s*Name/, '')
    .replace(/\s*-\s*Title\s*-\s*Name/, '')
    .replace(/\s*Course-\s*YYYY/, 'Course')
    .replace(/\s*\[DD MMM YYYY\]/, '')
    .replace(/\s*\(MM\/YYYY\)/, '')
    .replace(/\s*Weekly posts\s*\(DD MMM 2024\)/, ' Weekly posts')
    .trim();
}

function extractInstructionsUrl(text: string): { description: string; instructionsUrl: string | null } {
  const match = text.match(/\s*\(\[([^\]]*)\]\((https?:\/\/[^)]+)\)\)\s*|\s*\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*/);
  if (!match) return { description: text, instructionsUrl: null };

  const url = match[2] || match[4];
  const cleaned = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
  return { description: cleaned, instructionsUrl: url };
}

function extractProjectLinks(card: TrelloCard): { name: string; url: string }[] {
  const attachments = card.attachments || [];
  return attachments
    .filter((a) => a.url && !a.url.includes('trello.com/1/cards/'))
    .map((a) => ({ name: a.name || a.url, url: a.url }));
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// ---------------------------------------------------------------------------
// Trello card -> Project + Tasks mapping
// ---------------------------------------------------------------------------

function extractDateFromCardName(name: string): string | null {
  const iso = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const mmmdd = name.match(/(\d{4})-([A-Za-z]{3})-(\d{2})/);
  if (mmmdd) {
    const mon = MONTHS[mmmdd[2].toLowerCase()];
    if (mon) return `${mmmdd[1]}-${mon}-${mmmdd[3]}`;
  }

  const dmy = name.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (dmy) {
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

function trelloCardToProject(card: TrelloCard) {
  const fallbackDate = card.dateLastActivity
    ? card.dateLastActivity.split('T')[0]
    : new Date().toISOString().split('T')[0];
  const anchorDate = card.due
    ? card.due.split('T')[0]
    : extractDateFromCardName(card.name) || fallbackDate;

  const project: Record<string, unknown> = {
    title: card.name,
    anchorDate,
    description: card.desc || null,
  };

  const links = extractProjectLinks(card);
  if (links.length > 0) project.links = links;

  return project;
}

function trelloChecklistItemsToTasks(card: TrelloCard, boardChecklists: TrelloChecklist[], projectId: string | null) {
  const cardChecklists = (card.idChecklists || [])
    .map((clId) => boardChecklists.find((cl) => cl.id === clId))
    .filter((cl): cl is TrelloChecklist => Boolean(cl))
    .sort((a, b) => a.pos - b.pos);

  const tasks: Record<string, unknown>[] = [];
  const fallbackDate = card.dateLastActivity
    ? card.dateLastActivity.split('T')[0]
    : new Date().toISOString().split('T')[0];
  const anchorDate = card.due
    ? card.due.split('T')[0]
    : extractDateFromCardName(card.name) || fallbackDate;

  for (const cl of cardChecklists) {
    const items = (cl.checkItems || []).sort((a, b) => a.pos - b.pos);
    for (const item of items) {
      const { description: cleanedName, instructionsUrl } = extractInstructionsUrl(item.name);
      const taskData: Record<string, unknown> = {
        description: `[${cl.name}] ${cleanedName}`,
        date: item.due ? item.due.split('T')[0] : anchorDate,
        status: item.state === 'complete' ? 'done' : 'todo',
        source: 'manual',
      };
      if (instructionsUrl) taskData.comment = instructionsUrl;
      if (projectId) taskData.projectId = projectId;
      tasks.push(taskData);
    }
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// CSV -> Tasks mapping
// ---------------------------------------------------------------------------

function csvRowToTask(row: string[]): Record<string, unknown> | null {
  const [dateRaw, task, notes, status] = row;

  const date = parseDate(dateRaw);
  const description = (task || '').trim();

  if (!date || !description) return null;

  const normalizedStatus = (status || '').trim().toUpperCase();
  const appStatus = (normalizedStatus === 'DONE' || normalizedStatus === 'DONEDONE')
    ? 'done'
    : 'todo';

  const result: Record<string, unknown> = {
    description,
    date,
    status: appStatus,
    source: 'manual',
  };

  const comment = (notes || '').trim();
  if (comment) result.comment = comment;

  return result;
}

// ---------------------------------------------------------------------------
// Recurring config detection from CSV patterns
// ---------------------------------------------------------------------------

const RECURRING_PATTERNS = [
  {
    pattern: /^Invite people to Slack from/i,
    config: {
      description: 'Invite people to Slack from Airtable',
      schedule: 'daily',
    },
  },
  {
    pattern: /^Create new trello cards if necessary/i,
    config: {
      description: 'Create new Trello cards and review existing ones',
      schedule: 'daily',
    },
  },
  {
    pattern: /^Make sure the newsletter for the next week is prepared/i,
    config: {
      description: 'Ensure newsletter for next week is prepared',
      schedule: 'weekly',
      dayOfWeek: 2,
    },
  },
  {
    pattern: /^Prepare a newsletter for the week after next/i,
    config: {
      description: 'Prepare newsletter for the week after next',
      schedule: 'weekly',
      dayOfWeek: 3,
    },
  },
  {
    pattern: /^Backup the mailing list from mailchimp/i,
    config: {
      description: 'Backup MailChimp mailing list to Google Drive',
      schedule: 'weekly',
      dayOfWeek: 4,
    },
  },
  {
    pattern: /^Create a slack dump/i,
    config: {
      description: 'Create Slack dump',
      schedule: 'monthly',
      dayOfMonth: 1,
    },
  },
];

function isRecurringTask(description: string): boolean {
  return RECURRING_PATTERNS.some((p) => p.pattern.test(description));
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== DataTasks Migration Script ===');
  if (DRY_RUN) console.log('** DRY RUN - no data will be written **\n');

  // Load Trello data
  console.log('Loading Trello board export...');
  const trello = JSON.parse(fs.readFileSync(TRELLO_FILE, 'utf-8'));
  const allCards: TrelloCard[] = trello.cards || [];
  const allChecklists: TrelloChecklist[] = trello.checklists || [];
  const allLists: TrelloList[] = trello.lists || [];

  console.log(`  Cards: ${allCards.length}`);
  console.log(`  Checklists: ${allChecklists.length}`);
  console.log(`  Lists: ${allLists.length}`);

  // Identify lists
  const listMap: Record<string, TrelloList> = {};
  for (const list of allLists) {
    listMap[list.id] = list;
  }

  // Separate template cards from regular cards
  const templateCards = allCards.filter((c) => c.isTemplate);
  const activeListNames = ['Preparation', 'Announced', 'After event'];
  const activeLists = allLists.filter(
    (l) => activeListNames.some((n) => l.name.toLowerCase().includes(n.toLowerCase())) && !l.closed
  );
  const activeListIds = new Set(activeLists.map((l) => l.id));
  const activeCards = allCards.filter(
    (c) => !c.isTemplate && !c.closed && activeListIds.has(c.idList)
  );

  console.log(`  Template cards: ${templateCards.length}`);
  console.log(`  Active cards (Preparation/Announced/After event): ${activeCards.length}`);

  // Connect to DB (persistent LevelDB in .data/)
  let client: DynamoDBDocumentClient | null = null;
  if (!DRY_RUN) {
    console.log('\nStarting local DynamoDB (persistent)...');
    const port = await startLocal();
    client = await getClient(port);
    await createTables(client);
    console.log('  DB ready.');
  }

  const stats = {
    templates: 0,
    projects: 0,
    tasks: 0,
    recurringConfigs: 0,
    skippedDuplicateTemplates: 0,
    skippedRecurringTasks: 0,
    skippedBlankRows: 0,
  };

  // -----------------------------------------------------------------------
  // 1. Import Trello templates
  // -----------------------------------------------------------------------

  if (IMPORT_ALL || TEMPLATES_ONLY) {
    console.log('\n--- Importing Trello Templates ---');

    const SKIP_LEGACY = ['62df9cbc51d95e6fa50c8f56'];

    let existingNames = new Set<string>();
    if (!DRY_RUN) {
      const existing = await listTemplates(client!);
      existingNames = new Set(existing.map((t) => t.name));
    }

    for (const card of templateCards) {
      if (SKIP_LEGACY.includes(card.id)) {
        console.log(`  SKIP (legacy): ${card.name}`);
        continue;
      }

      const template = trelloTemplateToAppTemplate(card, allChecklists);

      if (template.taskDefinitions.length === 0) {
        console.log(`  SKIP (no tasks): ${card.name}`);
        continue;
      }

      if (existingNames.has(template.name)) {
        console.log(`  SKIP (exists): ${template.name}`);
        stats.skippedDuplicateTemplates++;
        continue;
      }

      console.log(`  Template: ${template.name} (${template.type}) - ${template.taskDefinitions.length} task definitions`);

      if (DRY_RUN) {
        for (const td of template.taskDefinitions) {
          console.log(`    [offset ${td.offsetDays >= 0 ? '+' : ''}${td.offsetDays}] ${td.description.substring(0, 80)}`);
        }
      } else {
        await createTemplate(client!, template as Record<string, unknown>);
        existingNames.add(template.name);
      }

      stats.templates++;
    }
  }

  // -----------------------------------------------------------------------
  // 2. Import active Trello cards as projects + tasks
  // -----------------------------------------------------------------------

  if (IMPORT_ALL || CARDS_ONLY) {
    console.log('\n--- Importing Active Trello Cards as Projects ---');

    for (const card of activeCards) {
      const projectData = trelloCardToProject(card);
      const listName = listMap[card.idList]?.name || 'Unknown';

      console.log(`  Project: ${(projectData.title as string).substring(0, 70)} [${listName}]`);

      let projectId: string | null = null;

      if (!DRY_RUN) {
        const project = await createProject(client!, projectData);
        projectId = project.id;
      }

      stats.projects++;

      // Create tasks from checklists
      const tasks = trelloChecklistItemsToTasks(card, allChecklists, projectId);
      for (const task of tasks) {
        if (DRY_RUN) {
          console.log(`    [${task.status}] ${(task.description as string).substring(0, 70)}`);
        } else {
          await createTask(client!, task);
        }
        stats.tasks++;
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3. Import CSV tasks
  // -----------------------------------------------------------------------

  if (IMPORT_ALL || CSV_ONLY) {
    console.log('\n--- Importing CSV Tasks ---');

    console.log('  Processing: TODO list - todo.csv');
    const todoRows = parseCSVFile(CSV_TODO_FILE);
    for (let ri = 0; ri < todoRows.length; ri++) {
      if (ri === 0) continue; // skip header
      const row = todoRows[ri];
      const task = csvRowToTask(row);
      if (!task) {
        stats.skippedBlankRows++;
        continue;
      }

      if (isRecurringTask(task.description as string)) {
        stats.skippedRecurringTasks++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`    [${task.status}] ${task.date} ${(task.description as string).substring(0, 60)}`);
      } else {
        await createTask(client!, task);
      }
      stats.tasks++;
    }

    if (INCLUDE_DONE) {
      console.log('  Processing: TODO list - done.csv');
      const doneRows = parseCSVFile(CSV_DONE_FILE);
      for (let ri = 0; ri < doneRows.length; ri++) {
        if (ri === 0) continue; // skip header
        const row = doneRows[ri];
        const task = csvRowToTask(row);
        if (!task) {
          stats.skippedBlankRows++;
          continue;
        }

        if (isRecurringTask(task.description as string)) {
          stats.skippedRecurringTasks++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`    [${task.status}] ${task.date} ${(task.description as string).substring(0, 60)}`);
        } else {
          await createTask(client!, task);
        }
        stats.tasks++;
      }
    } else {
      console.log('  Skipping done.csv (use --include-done to import)');
    }
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  console.log('\n=== Migration Summary ===');
  console.log(`  Templates created:           ${stats.templates}`);
  console.log(`  Projects created:            ${stats.projects}`);
  console.log(`  Tasks created:               ${stats.tasks}`);
  console.log(`  Skipped duplicate templates: ${stats.skippedDuplicateTemplates}`);
  console.log(`  Skipped recurring tasks:     ${stats.skippedRecurringTasks}`);
  console.log(`  Skipped blank rows:          ${stats.skippedBlankRows}`);

  if (DRY_RUN) {
    console.log('\n** This was a dry run. Re-run without --dry-run to write data. **');
  }

  console.log('\nNote: Recurring task patterns detected in CSV data should be');
  console.log('configured as recurring configs via the app UI or API:');
  for (const rp of RECURRING_PATTERNS) {
    console.log(`  - ${rp.config.description} (${rp.config.schedule})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
