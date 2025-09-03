
// This file initializes the Firebase Admin SDK for backend use.
// It allows your server to interact securely with Firestore, Auth, etc.

const admin = require('firebase-admin');

// Load your service account credentials (downloaded from Firebase Console)
const serviceAccount = require('./serviceAccountKey.json'); // Ensure this file exists

// Initialize the Firebase Admin app with the service account (guarded)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Export the initialized admin instance for use in other backend files
module.exports = admin;
