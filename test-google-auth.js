// Run this script to trigger Google OAuth and print the authorization link
const { addOrUpdateContact } = require('./server/googleContacts');

(async () => {
  try {
    // Dummy data for test
    await addOrUpdateContact({
      name: 'Test User',
      email: 'testuser@example.com',
      phone: '+1234567890'
    });
    console.log('Contact added successfully!');
  } catch (err) {
    console.error(err.message);
  }
})();
