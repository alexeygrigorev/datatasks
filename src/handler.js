const { route } = require('./router');

async function handler(event, context) {
  return route(event);
}

module.exports = { handler };
