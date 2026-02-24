import { getClient, startLocal } from '../src/db/client';
import { createTables } from '../src/db/setup';
import { listUsers, createUserWithId } from '../src/db/users';
import type { User } from '../src/types';

const USERS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Grace', email: 'grace@datatalks.club' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Valeriia', email: 'valeriia@datatalks.club' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Alexey', email: 'alexey@datatalks.club' },
];

async function seed(): Promise<void> {
  // Start local DynamoDB and get client
  const port = await startLocal();
  const client = await getClient(port);

  // Create tables if they don't exist
  await createTables(client);

  // Check if users already exist
  const existing = await listUsers(client);
  if (existing.length > 0) {
    console.log(`Users already exist (${existing.length} found). Skipping seed.`);
    return;
  }

  // Create users with stable IDs
  const created: User[] = [];
  for (const userData of USERS) {
    const { id, ...data } = userData;
    const user = await createUserWithId(client, id, data);
    created.push(user);
    console.log(`Created user: ${user.name} (${user.email}) — id: ${user.id}`);
  }

  console.log(`\nSeed complete. Created ${created.length} users.`);
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

export { seed, USERS };
