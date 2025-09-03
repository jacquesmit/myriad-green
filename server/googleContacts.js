// Google People API integration for adding/updating contacts
// Place your google-credentials.json in the project root

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/contacts'];
const TOKEN_PATH = path.join(__dirname, '../google-token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../google-credentials.json');

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
    return oAuth2Client;
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('Authorize this app by visiting this url:', authUrl);
    // After visiting the URL, paste the code here to complete setup
    throw new Error('Google OAuth2 token not found. Run setup to authorize.');
  }
}

async function addOrUpdateContact({ name, email, phone }) {
  const auth = await authorize();
  const people = google.people({ version: 'v1', auth });
  const resource = {
    names: [{ givenName: name }],
    emailAddresses: [{ value: email }],
    phoneNumbers: [{ value: phone }]
  };
  await people.people.createContact({ requestBody: resource });
}

module.exports = { addOrUpdateContact };
