
// This route handles adding booking events to Google Calendar via the backend.
// It expects a POST request with an event object in the body (must include summary, start, end).

const express = require('express');
const router = express.Router();
const { addEventToCalendar } = require('../calendar');

// POST /api/add-calendar-event
// Example event body:
// {
//   "summary": "Booking for John Doe",
//   "start": { "dateTime": "2025-08-10T10:00:00+02:00" },
//   "end": { "dateTime": "2025-08-10T11:00:00+02:00" },
//   ...other Google Calendar event fields...
// }
router.post('/add-calendar-event', async (req, res) => {
  try {
    const event = req.body;
    // Validate required fields
    if (!event || !event.start || !event.end || !event.summary) {
      return res.status(400).json({ success: false, error: 'Missing required event fields (summary, start, end).' });
    }
    // Add the event to Google Calendar
    const result = await addEventToCalendar(event);
    res.json({ success: true, event: result });
  } catch (err) {
    // Return error details to the client
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export the router to be used in your main Express app
module.exports = router;
