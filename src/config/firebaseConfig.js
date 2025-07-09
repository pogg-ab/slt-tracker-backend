const admin = require('firebase-admin');

// IMPORTANT: The path to your service account key file
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('✅ Firebase Admin SDK initialized successfully.');

// Export the initialized admin object so we can use it elsewhere
module.exports = admin;