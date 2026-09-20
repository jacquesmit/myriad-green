'use strict';

require('dotenv').config();

const { createRuntimeApp } = require('./runtime/app');

const token = process.env.MAGOS_RUNTIME_TOKEN;
if (!token) {
  throw new Error(
    'MAGOS_RUNTIME_TOKEN is required; refusing to start an unauthenticated MAGOS runtime.'
  );
}

const app = createRuntimeApp({
  token,
  version: process.env.MAGOS_RUNTIME_VERSION || 'P3'
});

const port = Number(process.env.PORT || process.env.MAGOS_PORT || 3000);
const host = process.env.MAGOS_BIND_HOST || '127.0.0.1';

const server = app.listen(port, host, () => {
  console.log(
    'MAGOS Automation Runtime V1 (cPanel/Passenger) listening on ' +
    host + ':' + port
  );
});

function shutdown(signal) {
  console.log('MAGOS cPanel runtime received ' + signal + '; shutting down.');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
