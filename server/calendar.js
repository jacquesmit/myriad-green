
// This file handles Google Calendar integration for adding booking events from the backend.
// It uses a service account and the googleapis library to authenticate and interact with the Calendar API.
//
// Prerequisites:
// - Place your google-credentials.json in the project root.
// - Add your calendar ID to the .env file as GOOGLE_CALENDAR_ID.
// - Install dependencies: npm install googleapis dotenv
//
// Usage: Call addEventToCalendar(event) with a valid event object.

require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');


// Path to your service account key file
const KEYFILEPATH = path.join(__dirname, '../google-credentials.json');
// Scopes required for Google Calendar API
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// Calendar ID loaded from environment variable
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;


// Set up Google Auth client
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});



// Adds an event to the specified Google Calendar
// Throws an error if the API call fails
async function addEventToCalendar(event) {
  try {
    const client = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: client });
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });
    return response.data;
  } catch (err) {
    // Log error details for debugging
    console.error('Google Calendar API error:', err);
    // Provide a user-friendly error message
    throw new Error(
      err.errors && err.errors[0] && err.errors[0].message
        ? `Calendar error: ${err.errors[0].message}`
        : err.message || 'Unknown error occurred while adding event to Google Calendar.'
    );
  }
}


// Example Express route (for reference only, not used in this file):
// const express = require('express');
// const router = express.Router();
// router.post('/add-calendar-event', async (req, res) => {
//   try {
//     const event = req.body;
//     const result = await addEventToCalendar(event);
//     res.json({ success: true, event: result });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });
// module.exports = router;


// Export the function for use in route files
module.exports = { addEventToCalendar };
