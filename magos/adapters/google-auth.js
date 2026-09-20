'use strict';

const { google } = require('googleapis');

function loadCredentialsFromEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

function createGoogleAuth(scopes) {
  const credentials = loadCredentialsFromEnv();
  if (credentials) {
    return new google.auth.GoogleAuth({ credentials, scopes });
  }
  return new google.auth.GoogleAuth({ scopes });
}

module.exports = { createGoogleAuth };
