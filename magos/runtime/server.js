'use strict';

require('dotenv').config();

const { createRuntimeApp } = require('./app');

const token = process.env.MAGOS_RUNTIME_TOKEN;
if (!token) {
  console.error('MAGOS_RUNTIME_TOKEN is required; refusing to start an unauthenticated writer runtime.');
  process.exit(1);
}

const port = Number(process.env.PORT || process.env.MAGOS_PORT || 8080);
const app = createRuntimeApp({ token });

const server = app.listen(port, '0.0.0.0', () => {
  console.log('MAGOS Automation Runtime V1 listening on port ' + port);
});

function shutdown(signal) {
  console.log('MAGOS runtime received ' + signal + '; shutting down.');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
