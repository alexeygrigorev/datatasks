import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { route } from './router';
import { getClient } from './db/client';
import { createTables } from './db/setup';
import type { LambdaEvent, LambdaResponse } from './types';

let client: DynamoDBDocumentClient | null = null;
let initialized = false;

async function handler(event: LambdaEvent, context: unknown): Promise<LambdaResponse> {
  if (!initialized) {
    client = await getClient();
    await createTables(client);
    initialized = true;
  }

  return route(event, client!);
}

export { handler };
