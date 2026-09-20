'use strict';

require('dotenv').config();

const baseUrl = String(process.env.MAGOS_RUNTIME_URL || '').replace(/\/$/, '');
const token = process.env.MAGOS_RUNTIME_TOKEN || '';

if (!baseUrl) {
  console.error('MAGOS_RUNTIME_URL is required');
  process.exit(1);
}
if (!token) {
  console.error('MAGOS_RUNTIME_TOKEN is required');
  process.exit(1);
}

async function check(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(path + ' failed with HTTP ' + response.status + ': ' + JSON.stringify(body));
  }
  return body;
}

(async () => {
  const health = await check('/healthz');
  const ready = await check('/readyz');
  const probe = await check('/v1/probes/google-sheets', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json'
    },
    body: '{}'
  });

  console.log(JSON.stringify({ health, ready, probe }, null, 2));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
