const { route } = require('./router');
const { getClient } = require('./db/client');
const { createTables } = require('./db/setup');

let client = null;
let initialized = false;

async function handler(event, context) {
  if (!initialized) {
    client = await getClient();
    await createTables(client);
    initialized = true;
  }

  return route(event, client);
}

module.exports = { handler };
