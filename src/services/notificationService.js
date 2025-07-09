const admin = require('../config/firebaseConfig'); // Your initialized Firebase Admin
const pool = require('../config/db');

/**
 * Sends a push notification to all registered devices for a given user.
 * @param {number} userId The ID of the user to notify.
 * @param {string} title The title of the notification.
 * @param {string} body The body/message of the notification.
 */
const sendNotification = async (userId, title, body) => {
    try {
        // 1. Find ALL device tokens for the target user ID.
        const tokenResult = await pool.query('SELECT fcm_token FROM Devices WHERE user_id = $1', [userId]);

        // Check if any tokens were found.
        if (tokenResult.rows.length === 0) {
            console.log(`No devices found for user ${userId}. Skipping notification.`);
            return;
        }

        // 2. Extract just the token strings into an array.
        const tokens = tokenResult.rows.map(row => row.fcm_token);

        // 3. Create the notification payload.
        const message = {
            notification: {
                title: title,
                body: body,
            },
            tokens: tokens, // Use the 'tokens' key for multicast
        };

        // 4. Use sendMulticast to send the notification to all devices at once.
        const response = await admin.messaging().sendMulticast(message);
        
        console.log(`Successfully sent ${response.successCount} messages to user ${userId}.`);

        // OPTIONAL: Advanced error handling.
        // You can check for failed messages and remove invalid tokens from your database.
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log(`List of tokens that failed: ${failedTokens}`);
            // TODO: Add logic here to remove these failedTokens from the Devices table.
        }

    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

module.exports = { sendNotification };