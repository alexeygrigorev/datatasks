const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const { TABLE_TASKS } = require('./setup');
const { createTask } = require('./tasks');

/**
 * Strip DynamoDB key attributes (PK, SK) from an item.
 */
function cleanItem(item) {
  if (!item) return null;
  const { PK, SK, ...rest } = item;
  return rest;
}

/**
 * Create a new recurring config. Generates a UUID, sets createdAt/updatedAt.
 */
async function createRecurringConfig(client, data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `RECURRING#${id}`,
    SK: `RECURRING#${id}`,
    id,
    createdAt: now,
    updatedAt: now,
    enabled: true,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_TASKS,
      Item: item,
    })
  );

  return cleanItem(item);
}

/**
 * Get a recurring config by id.
 */
async function getRecurringConfig(client, id) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_TASKS,
      Key: { PK: `RECURRING#${id}`, SK: `RECURRING#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item) : null;
}

/**
 * Partial update of a recurring config.
 */
async function updateRecurringConfig(client, id, updates) {
  const now = new Date().toISOString();
  const fields = { ...updates, updatedAt: now };

  const expressionParts = [];
  const expressionAttrNames = {};
  const expressionAttrValues = {};

  let i = 0;
  for (const [key, value] of Object.entries(fields)) {
    const nameToken = `#f${i}`;
    const valueToken = `:v${i}`;
    expressionParts.push(`${nameToken} = ${valueToken}`);
    expressionAttrNames[nameToken] = key;
    expressionAttrValues[valueToken] = value;
    i++;
  }

  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE_TASKS,
      Key: { PK: `RECURRING#${id}`, SK: `RECURRING#${id}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttrNames,
      ExpressionAttributeValues: expressionAttrValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return cleanItem(result.Attributes);
}

/**
 * Delete a recurring config by id.
 */
async function deleteRecurringConfig(client, id) {
  await client.send(
    new DeleteCommand({
      TableName: TABLE_TASKS,
      Key: { PK: `RECURRING#${id}`, SK: `RECURRING#${id}` },
    })
  );
}

/**
 * List all recurring configs by scanning for items where PK begins with "RECURRING#".
 */
async function listRecurringConfigs(client) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_TASKS,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'RECURRING#' },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * List only enabled recurring configs.
 */
async function listEnabledRecurringConfigs(client) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_TASKS,
      FilterExpression: 'begins_with(PK, :prefix) AND enabled = :enabled',
      ExpressionAttributeValues: {
        ':prefix': 'RECURRING#',
        ':enabled': true,
      },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * Check if a recurring task already exists for a given config and date.
 * Returns true if a matching task exists.
 */
async function recurringTaskExists(client, recurringConfigId, date) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_TASKS,
      FilterExpression:
        'begins_with(PK, :taskPrefix) AND #src = :source AND recurringConfigId = :configId AND #d = :date',
      ExpressionAttributeNames: {
        '#src': 'source',
        '#d': 'date',
      },
      ExpressionAttributeValues: {
        ':taskPrefix': 'TASK#',
        ':source': 'recurring',
        ':configId': recurringConfigId,
        ':date': date,
      },
    })
  );

  return (result.Items || []).length > 0;
}

/**
 * Generate concrete task instances from enabled recurring configs for a date range.
 *
 * @param {object} client - DynamoDB document client
 * @param {string} startDate - Start date (YYYY-MM-DD), inclusive
 * @param {string} endDate - End date (YYYY-MM-DD), inclusive
 * @returns {{ generated: Array, skipped: number }}
 */
async function generateRecurringTasks(client, startDate, endDate) {
  const configs = await listEnabledRecurringConfigs(client);

  const generated = [];
  let skipped = 0;

  // Build list of dates in range
  const dates = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  for (const config of configs) {
    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T00:00:00Z');

      let matches = false;

      if (config.schedule === 'daily') {
        matches = true;
      } else if (config.schedule === 'weekly') {
        matches = d.getUTCDay() === config.dayOfWeek;
      } else if (config.schedule === 'monthly') {
        matches = d.getUTCDate() === config.dayOfMonth;
      }

      if (!matches) continue;

      // Idempotency check
      const exists = await recurringTaskExists(client, config.id, dateStr);
      if (exists) {
        skipped++;
        continue;
      }

      // Create the task
      const taskData = {
        description: config.description,
        date: dateStr,
        status: 'todo',
        source: 'recurring',
        recurringConfigId: config.id,
      };

      if (config.projectId) {
        taskData.projectId = config.projectId;
      }

      const task = await createTask(client, taskData);
      generated.push(task);
    }
  }

  return { generated, skipped };
}

module.exports = {
  createRecurringConfig,
  getRecurringConfig,
  updateRecurringConfig,
  deleteRecurringConfig,
  listRecurringConfigs,
  listEnabledRecurringConfigs,
  generateRecurringTasks,
};
