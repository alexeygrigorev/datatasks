const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const { TABLE_PROJECTS } = require('./setup');

/**
 * Strip DynamoDB key attributes (PK, SK) from an item.
 */
function cleanItem(item) {
  if (!item) return null;
  const { PK, SK, ...rest } = item;
  return rest;
}

/**
 * Create a new project. Generates a UUID, sets createdAt/updatedAt.
 */
async function createProject(client, data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `PROJECT#${id}`,
    SK: `PROJECT#${id}`,
    id,
    createdAt: now,
    updatedAt: now,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_PROJECTS,
      Item: item,
    })
  );

  return cleanItem(item);
}

/**
 * Get a project by id.
 */
async function getProject(client, id) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_PROJECTS,
      Key: { PK: `PROJECT#${id}`, SK: `PROJECT#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item) : null;
}

/**
 * Partial update of a project.
 */
async function updateProject(client, id, updates) {
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
      TableName: TABLE_PROJECTS,
      Key: { PK: `PROJECT#${id}`, SK: `PROJECT#${id}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttrNames,
      ExpressionAttributeValues: expressionAttrValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return cleanItem(result.Attributes);
}

/**
 * Delete a project by id.
 */
async function deleteProject(client, id) {
  await client.send(
    new DeleteCommand({
      TableName: TABLE_PROJECTS,
      Key: { PK: `PROJECT#${id}`, SK: `PROJECT#${id}` },
    })
  );
}

/**
 * List all projects by scanning for items where PK begins with "PROJECT#".
 */
async function listProjects(client) {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_PROJECTS,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'PROJECT#' },
    })
  );

  return (result.Items || []).map(cleanItem);
}

module.exports = {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
};
