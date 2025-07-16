// src/config/firebaseConfig.js
const admin = require('firebase-admin');

// IMPORTANT: The path to your service account key file
const serviceAccount = require('../../firebase-service-account-key.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
}

module.exports = admin;