const {
  CreateTableCommand,
  DeleteTableCommand,
} = require('@aws-sdk/client-dynamodb');

const TABLE_TASKS = 'Tasks';
const TABLE_PROJECTS = 'Projects';
const TABLE_TEMPLATES = 'Templates';

/**
 * Create all application tables (Tasks, Projects, Templates) with GSIs.
 * Idempotent — silently ignores ResourceInUseException if a table already exists.
 */
async function createTables(client) {
  const tableDefinitions = [
    {
      TableName: TABLE_TASKS,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'date', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' },
        { AttributeName: 'projectId', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI-Date',
          KeySchema: [
            { AttributeName: 'date', KeyType: 'HASH' },
            { AttributeName: 'status', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI-Project',
          KeySchema: [
            { AttributeName: 'projectId', KeyType: 'HASH' },
            { AttributeName: 'date', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI-Status',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'date', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: TABLE_PROJECTS,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: TABLE_TEMPLATES,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  ];

  for (const def of tableDefinitions) {
    try {
      await client.send(new CreateTableCommand(def));
    } catch (err) {
      if (err.name === 'ResourceInUseException') {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Delete all application tables. Used for test cleanup.
 */
async function deleteTables(client) {
  const tableNames = [TABLE_TASKS, TABLE_PROJECTS, TABLE_TEMPLATES];

  for (const tableName of tableNames) {
    try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
        continue;
      }
      throw err;
    }
  }
}

module.exports = {
  createTables,
  deleteTables,
  TABLE_TASKS,
  TABLE_PROJECTS,
  TABLE_TEMPLATES,
};
