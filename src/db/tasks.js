const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const { TABLE_TASKS } = require('./setup');

/**
 * Strip DynamoDB key attributes (PK, SK) from an item, returning a clean object.
 */
function cleanItem(item) {
  if (!item) return null;
  const { PK, SK, ...rest } = item;
  return rest;
}

/**
 * Create a new task. Generates a UUID, sets createdAt/updatedAt, and writes to DynamoDB.
 * Returns the clean task object (without PK/SK).
 */
async function createTask(client, taskData) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `TASK#${id}`,
    SK: `TASK#${id}`,
    id,
    createdAt: now,
    updatedAt: now,
    status: 'todo',
    ...taskData,
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
 * Get a task by id. Returns the clean object or null if not found.
 */
async function getTask(client, id) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_TASKS,
      Key: { PK: `TASK#${id}`, SK: `TASK#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item) : null;
}

/**
 * Partial update of a task. Builds an UpdateExpression from the updates object.
 * Always updates updatedAt.
 */
async function updateTask(client, id, updates) {
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
      Key: { PK: `TASK#${id}`, SK: `TASK#${id}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttrNames,
      ExpressionAttributeValues: expressionAttrValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return cleanItem(result.Attributes);
}

/**
 * Delete a task by id.
 */
async function deleteTask(client, id) {
  await client.send(
    new DeleteCommand({
      TableName: TABLE_TASKS,
      Key: { PK: `TASK#${id}`, SK: `TASK#${id}` },
    })
  );
}

/**
 * List tasks for a specific date using GSI-Date.
 */
async function listTasksByDate(client, date) {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_TASKS,
      IndexName: 'GSI-Date',
      KeyConditionExpression: '#d = :date',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: { ':date': date },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * List tasks within a date range. Uses a Scan with a FilterExpression since
 * date is the partition key on GSI-Date and range queries require sort key.
 */
async function listTasksByDateRange(client, startDate, endDate) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_TASKS,
      FilterExpression:
        '#d BETWEEN :start AND :end AND begins_with(PK, :prefix)',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: {
        ':start': startDate,
        ':end': endDate,
        ':prefix': 'TASK#',
      },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * List tasks for a specific project using GSI-Project.
 */
async function listTasksByProject(client, projectId) {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_TASKS,
      IndexName: 'GSI-Project',
      KeyConditionExpression: 'projectId = :pid',
      ExpressionAttributeValues: { ':pid': projectId },
    })
  );

  return (result.Items || []).map(cleanItem);
}

/**
 * List tasks by status using GSI-Status.
 */
async function listTasksByStatus(client, status) {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_TASKS,
      IndexName: 'GSI-Status',
      KeyConditionExpression: '#s = :status',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': status },
    })
  );

  return (result.Items || []).map(cleanItem);
}

module.exports = {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasksByDate,
  listTasksByDateRange,
  listTasksByProject,
  listTasksByStatus,
};
