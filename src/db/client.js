const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

let dynaliteServer = null;

function isLocal() {
  return (
    process.env.IS_LOCAL === 'true' ||
    process.env.IS_LOCAL === '1' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'local'
  );
}

/**
 * Start a dynalite server in-process and return the port it is listening on.
 * If the server is already running, return the existing port.
 */
async function startLocal(port = 0) {
  if (dynaliteServer) {
    const addr = dynaliteServer.address();
    return addr.port;
  }

  const dynalite = require('dynalite');
  dynaliteServer = dynalite({ createTableMs: 0 });

  return new Promise((resolve, reject) => {
    dynaliteServer.listen(port, (err) => {
      if (err) return reject(err);
      resolve(dynaliteServer.address().port);
    });
  });
}

/**
 * Stop the dynalite server if it is running.
 */
async function stopLocal() {
  if (!dynaliteServer) return;
  return new Promise((resolve, reject) => {
    dynaliteServer.close((err) => {
      dynaliteServer = null;
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Get a DynamoDB Document Client.
 * In local/test mode the client points at the in-process dynalite instance.
 * In production it uses the default AWS SDK configuration.
 */
async function getClient(localPort) {
  if (isLocal()) {
    const port = localPort || (await startLocal());
    const raw = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: `http://localhost:${port}`,
      credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
    });
    return DynamoDBDocumentClient.from(raw);
  }

  const raw = new DynamoDBClient({});
  return DynamoDBDocumentClient.from(raw);
}

module.exports = { getClient, startLocal, stopLocal };
