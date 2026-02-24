import { getClient, startLocal } from '../src/db/client';
import { createTables } from '../src/db/setup';
import { listTemplates, createTemplate } from '../src/db/templates';
import type { Template } from '../src/types';

const DEFAULT_TEMPLATES = [
  {
    name: 'Newsletter',
    type: 'newsletter',
    taskDefinitions: [
      { refId: 'collect-topics', description: 'Collect newsletter topics and links', offsetDays: -10 },
      { refId: 'write-draft', description: 'Write newsletter draft', offsetDays: -7 },
      { refId: 'review-draft', description: 'Review and edit newsletter draft', offsetDays: -4 },
      { refId: 'prepare-images', description: 'Prepare images and formatting', offsetDays: -3 },
      { refId: 'schedule-send', description: 'Schedule newsletter in Mailchimp', offsetDays: -1 },
      { refId: 'send', description: 'Send newsletter', offsetDays: 0 },
      { refId: 'review-analytics', description: 'Review open rates and analytics', offsetDays: 3 },
    ],
  },
  {
    name: 'Course',
    type: 'course',
    taskDefinitions: [
      { refId: 'define-syllabus', description: 'Define course syllabus and modules', offsetDays: -30 },
      { refId: 'record-videos', description: 'Record course video content', offsetDays: -21 },
      { refId: 'create-homework', description: 'Create homework assignments', offsetDays: -14 },
      { refId: 'setup-platform', description: 'Set up course platform and enrollment', offsetDays: -10 },
      { refId: 'announce-course', description: 'Announce course on social media', offsetDays: -7 },
      { refId: 'open-registration', description: 'Open registration', offsetDays: -5 },
      { refId: 'send-welcome', description: 'Send welcome email to participants', offsetDays: -1 },
      { refId: 'course-start', description: 'Course start date', offsetDays: 0 },
      { refId: 'collect-feedback', description: 'Collect participant feedback', offsetDays: 7 },
      { refId: 'issue-certificates', description: 'Issue completion certificates', offsetDays: 14 },
    ],
  },
  {
    name: 'Event',
    type: 'event',
    taskDefinitions: [
      { refId: 'book-venue', description: 'Book venue or set up virtual meeting', offsetDays: -21 },
      { refId: 'create-event-page', description: 'Create event page and registration', offsetDays: -14 },
      { refId: 'announce-event', description: 'Announce event on social media', offsetDays: -10 },
      { refId: 'confirm-speakers', description: 'Confirm speakers and agenda', offsetDays: -7 },
      { refId: 'send-reminder', description: 'Send reminder to registered attendees', offsetDays: -2 },
      { refId: 'prep-materials', description: 'Prepare presentation materials', offsetDays: -1 },
      { refId: 'event-day', description: 'Event day', offsetDays: 0 },
      { refId: 'share-recording', description: 'Share event recording', offsetDays: 2 },
      { refId: 'post-summary', description: 'Post event summary and highlights', offsetDays: 5 },
    ],
  },
];

async function seed(): Promise<void> {
  // Start local DynamoDB and get client
  const port = await startLocal();
  const client = await getClient(port);

  // Create tables if they don't exist
  await createTables(client);

  // Check if templates already exist
  const existing = await listTemplates(client);
  if (existing.length > 0) {
    console.log(`Templates already exist (${existing.length} found). Skipping seed.`);
    return;
  }

  // Create default templates
  const created: Template[] = [];
  for (const templateData of DEFAULT_TEMPLATES) {
    const template = await createTemplate(client, templateData as Record<string, unknown>);
    created.push(template);
    console.log(`Created template: ${template.name} (${template.type}) with ${templateData.taskDefinitions.length} tasks — id: ${template.id}`);
  }

  console.log(`\nSeed complete. Created ${created.length} templates.`);
}

// Run if executed directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

export { seed, DEFAULT_TEMPLATES };
