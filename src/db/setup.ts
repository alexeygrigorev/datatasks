import {
  CreateTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const TABLE_TASKS = 'Tasks';
const TABLE_BUNDLES = 'Projects';
const TABLE_TEMPLATES = 'Templates';
const TABLE_USERS = 'Users';

/**
 * Create all application tables (Tasks, Bundles, Templates) with GSIs.
 * Idempotent — silently ignores ResourceInUseException if a table already exists.
 */
async function createTables(client: DynamoDBDocumentClient): Promise<void> {
  const tableDefinitions = [
    {
      TableName: TABLE_TASKS,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' as const },
        { AttributeName: 'SK', KeyType: 'RANGE' as const },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' as const },
        { AttributeName: 'SK', AttributeType: 'S' as const },
        { AttributeName: 'date', AttributeType: 'S' as const },
        { AttributeName: 'status', AttributeType: 'S' as const },
        { AttributeName: 'bundleId', AttributeType: 'S' as const },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI-Date',
          KeySchema: [
            { AttributeName: 'date', KeyType: 'HASH' as const },
            { AttributeName: 'status', KeyType: 'RANGE' as const },
          ],
          Projection: { ProjectionType: 'ALL' as const },
        },
        {
          IndexName: 'GSI-Bundle',
          KeySchema: [
            { AttributeName: 'bundleId', KeyType: 'HASH' as const },
            { AttributeName: 'date', KeyType: 'RANGE' as const },
          ],
          Projection: { ProjectionType: 'ALL' as const },
        },
        {
          IndexName: 'GSI-Status',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' as const },
            { AttributeName: 'date', KeyType: 'RANGE' as const },
          ],
          Projection: { ProjectionType: 'ALL' as const },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST' as const,
    },
    {
      TableName: TABLE_BUNDLES,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' as const },
        { AttributeName: 'SK', KeyType: 'RANGE' as const },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' as const },
        { AttributeName: 'SK', AttributeType: 'S' as const },
      ],
      BillingMode: 'PAY_PER_REQUEST' as const,
    },
    {
      TableName: TABLE_TEMPLATES,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' as const },
        { AttributeName: 'SK', KeyType: 'RANGE' as const },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' as const },
        { AttributeName: 'SK', AttributeType: 'S' as const },
      ],
      BillingMode: 'PAY_PER_REQUEST' as const,
    },
    {
      TableName: TABLE_USERS,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' as const },
        { AttributeName: 'SK', KeyType: 'RANGE' as const },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' as const },
        { AttributeName: 'SK', AttributeType: 'S' as const },
      ],
      BillingMode: 'PAY_PER_REQUEST' as const,
    },
  ];

  for (const def of tableDefinitions) {
    try {
      await client.send(new CreateTableCommand(def));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ResourceInUseException') {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Delete all application tables. Used for test cleanup.
 */
async function deleteTables(client: DynamoDBDocumentClient): Promise<void> {
  const tableNames = [TABLE_TASKS, TABLE_BUNDLES, TABLE_TEMPLATES, TABLE_USERS];

  for (const tableName of tableNames) {
    try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ResourceNotFoundException') {
        continue;
      }
      throw err;
    }
  }
}

export {
  createTables,
  deleteTables,
  TABLE_TASKS,
  TABLE_BUNDLES,
  TABLE_TEMPLATES,
  TABLE_USERS,
};
