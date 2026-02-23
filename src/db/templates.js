const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const { TABLE_TEMPLATES } = require('./setup');
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
 * Create a new template. Generates a UUID, sets createdAt/updatedAt.
 */
async function createTemplate(client, data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `TEMPLATE#${id}`,
    SK: `TEMPLATE#${id}`,
    id,
    createdAt: now,
    updatedAt: now,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_TEMPLATES,
      Item: item,
    })
  );

  return cleanItem(item);
}

/**
 * Get a template by id.
 */
async function getTemplate(client, id) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_TEMPLATES,
      Key: { PK: `TEMPLATE#${id}`, SK: `TEMPLATE#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item) : null;
}

/**
 * Partial update of a template.
 */
async function updateTemplate(client, id, updates) {
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
      TableName: TABLE_TEMPLATES,
      Key: { PK: `TEMPLATE#${id}`, SK: `TEMPLATE#${id}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttrNames,
      ExpressionAttributeValues: expressionAttrValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return cleanItem(result.Attributes);
}

/**
 * Delete a template by id.
 */
async function deleteTemplate(client, id) {
  await client.send(
    new DeleteCommand({
      TableName: TABLE_TEMPLATES,
      Key: { PK: `TEMPLATE#${id}`, SK: `TEMPLATE#${id}` },
    })
  );
}

/**
 * List all templates by scanning for items where PK begins with "TEMPLATE#".
 */
async function listTemplates(client) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_TEMPLATES,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'TEMPLATE#' },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * Instantiate a template: fetch the template, and for each taskDefinition
 * create a task with a calculated date (anchorDate + offsetDays).
 *
 * @param {object} client - DynamoDB document client
 * @param {string} templateId - the template to instantiate
 * @param {string} projectId - the project to assign tasks to
 * @param {string} anchorDate - ISO date string (YYYY-MM-DD) used as the base for offset calculations
 * @returns {Array} array of created task objects
 */
async function instantiateTemplate(client, templateId, projectId, anchorDate) {
  const template = await getTemplate(client, templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const taskDefinitions = template.taskDefinitions || [];
  const createdTasks = [];

  for (const def of taskDefinitions) {
    const anchor = new Date(anchorDate + 'T00:00:00Z');
    anchor.setUTCDate(anchor.getUTCDate() + (def.offsetDays || 0));
    const taskDate = anchor.toISOString().split('T')[0];

    const task = await createTask(client, {
      description: def.description,
      projectId,
      date: taskDate,
      source: 'template',
      templateTaskRef: def.refId,
      status: 'todo',
    });

    createdTasks.push(task);
  }

  return createdTasks;
}

module.exports = {
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  instantiateTemplate,
};
