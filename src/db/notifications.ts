import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { TABLE_NOTIFICATIONS } from './setup';
import type { Notification } from '../types';

/**
 * Strip DynamoDB key attributes (PK, SK) from an item.
 */
function cleanItem(item: Record<string, unknown> | undefined): Notification | null {
  if (!item) return null;
  const { PK, SK, ...rest } = item;
  return rest as unknown as Notification;
}

/**
 * Create a new notification. Generates a UUID, sets createdAt.
 */
async function createNotification(client: DynamoDBDocumentClient, data: Record<string, unknown>): Promise<Notification> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `NOTIFICATION#${id}`,
    SK: `NOTIFICATION#${id}`,
    id,
    dismissed: false,
    createdAt: now,
    ...data,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_NOTIFICATIONS,
      Item: item,
    })
  );

  return cleanItem(item) as Notification;
}

/**
 * Get a notification by id.
 */
async function getNotification(client: DynamoDBDocumentClient, id: string): Promise<Notification | null> {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NOTIFICATIONS,
      Key: { PK: `NOTIFICATION#${id}`, SK: `NOTIFICATION#${id}` },
    })
  );

  return result.Item ? cleanItem(result.Item as Record<string, unknown>) : null;
}

/**
 * Dismiss a notification by setting dismissed to true.
 */
async function dismissNotification(client: DynamoDBDocumentClient, id: string): Promise<Notification | null> {
  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE_NOTIFICATIONS,
      Key: { PK: `NOTIFICATION#${id}`, SK: `NOTIFICATION#${id}` },
      UpdateExpression: 'SET dismissed = :dismissed',
      ExpressionAttributeValues: { ':dismissed': true },
      ReturnValues: 'ALL_NEW',
    })
  );

  return cleanItem(result.Attributes as Record<string, unknown>);
}

/**
 * List undismissed notifications, sorted by most recent first.
 */
async function listUndismissedNotifications(client: DynamoDBDocumentClient): Promise<Notification[]> {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_NOTIFICATIONS,
      FilterExpression: 'begins_with(PK, :prefix) AND dismissed = :dismissed',
      ExpressionAttributeValues: {
        ':prefix': 'NOTIFICATION#',
        ':dismissed': false,
      },
    })
  );

  const notifications = (result.Items || []).map(
    (item) => cleanItem(item as Record<string, unknown>) as Notification
  );

  // Sort by createdAt descending (most recent first)
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return notifications;
}

export {
  createNotification,
  getNotification,
  dismissNotification,
  listUndismissedNotifications,
};
