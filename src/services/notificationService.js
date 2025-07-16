// src/services/notificationService.js
const pool = require('../config/db');
const { sendEmail } = require('../config/emailConfig');
const admin = require('firebase-admin');

const getDeviceTokensForUser = async (userId) => {
    try {
        const result = await pool.query('SELECT fcm_token FROM Devices WHERE user_id = $1', [userId]);
        return result.rows.map(row => row.fcm_token);
    } catch (error) {
        console.error(`Error fetching device tokens for user ${userId}:`, error);
        return [];
    }
};

const createAndSendNotification = async (recipientId, title, message, link) => {
    try {
        // Part 1: Save to DB
        await pool.query(
            'INSERT INTO Notifications (user_id, message, link) VALUES ($1, $2, $3)',
            [recipientId, message, link]
        );

        // Part 2: Send Email
        const userResult = await pool.query('SELECT email FROM Users WHERE user_id = $1', [recipientId]);
        if (userResult.rows.length > 0) {
            const recipientEmail = userResult.rows[0].email;
            const emailHtml = `<p>${message}</p><p><a href="${link}">Click here to view the update.</a></p>`;
            await sendEmail({
                to: recipientEmail,
                subject: title,
                html: emailHtml,
                text: `${message}\nView the update here: ${link}`
            });
        }

        // Part 3: Send Push Notification
        const deviceTokens = await getDeviceTokensForUser(recipientId);
        
        if (deviceTokens.length > 0) {
            const pushMessage = {
                notification: {
                    title: title,
                    body: message,
                },
                webpush: {
                    fcmOptions: {
                        link: link
                    }
                },
                tokens: deviceTokens,
            };

            // --- THIS IS THE FIX ---
            // Use the correct 'sendEachForMulticast' function
            const response = await admin.messaging().sendEachForMulticast(pushMessage);
            // --- END OF FIX ---

            console.log('Successfully sent push notification(s):', response.successCount);
            if (response.failureCount > 0) {
                console.error('Failed to send push notification(s):', response.failureCount);
            }
        }

    } catch (error) {
        console.error(`Failed to send notification to user ${recipientId}:`, error);
    }
};

module.exports = { createAndSendNotification };