import {
  PutCommand,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { TABLE_USERS } from './setup';
import type { User } from '../types';

/**
 * Strip DynamoDB key attributes (PK, SK) from an item.
 */
function cleanItem(item: Record<string, unknown> | undefined): User | null {
  if (!item) return null;
  const { PK, SK, ...rest } = item;
  return rest as unknown as User;
}

/**
 * Create a new user. Generates a UUID, sets createdAt, and writes to DynamoDB.
 * Returns the clean user object (without PK/SK).
 */
async function createUser(client: DynamoDBDocumentClient, data: Record<string, unknown>): Promise<User> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `USER#${id}`,
    SK: `USER#${id}`,
    id,
    createdAt: now,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_USERS,
      Item: item,
    })
  );

  return cleanItem(item) as User;
}

/**
 * Create a user with a specific ID. Used by the seed script for stable UUIDs.
 * Returns the clean user object (without PK/SK).
 */
async function createUserWithId(client: DynamoDBDocumentClient, id: string, data: Record<string, unknown>): Promise<User> {
  const now = new Date().toISOString();

  const item = {
    PK: `USER#${id}`,
    SK: `USER#${id}`,
    id,
    createdAt: now,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_USERS,
      Item: item,
    })
  );

  return cleanItem(item) as User;
}

/**
 * Get a user by id. Returns the clean object or null if not found.
 */
async function getUser(client: DynamoDBDocumentClient, id: string): Promise<User | null> {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_USERS,
      Key: { PK: `USER#${id}`, SK: `USER#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item as Record<string, unknown>) : null;
}

/**
 * List all users by scanning for items where PK begins with "USER#".
 */
async function listUsers(client: DynamoDBDocumentClient): Promise<User[]> {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_USERS,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'USER#' },
    })
  );

  return (result.Items || []).map((item) => cleanItem(item as Record<string, unknown>) as User);
}

export {
  createUser,
  createUserWithId,
  getUser,
  listUsers,
};
