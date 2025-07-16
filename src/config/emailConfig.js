// src/config/emailConfig.js
const nodemailer = require('nodemailer');
require('dotenv').config(); // Make sure environment variables are loaded

let transporter;

// Check if real Gmail credentials are provided in the .env file
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // --- USE REAL GMAIL ACCOUNT ---
    console.log('Email Service: Using GMAIL configuration.');
    transporter = nodemailer.createTransport({
        service: 'gmail', // Nodemailer knows the correct host and port for Gmail
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // This should be the 16-character App Password
        },
    });
} else {
    // --- USE FAKE ETHEREAL ACCOUNT (Fallback for quick local testing) ---
    console.log('Email Service: Using DEVELOPMENT (Ethereal) configuration.');
    const createEtherealTransporter = async () => {
        const testAccount = await nodemailer.createTestAccount();
        console.log('Ethereal account created. Preview URL: %s', nodemailer.getTestMessageUrl(testAccount));
        return nodemailer.createTransport({
            host: "smtp.ethereal.email", port: 587, secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
        });
    };
    transporter = createEtherealTransporter(); 
}

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        // Await the transporter if it's a promise (the Ethereal one)
        const emailTransporter = await Promise.resolve(transporter);

        const info = await emailTransporter.sendMail({
            from: `"SLT-Tracker" <${process.env.EMAIL_USER || 'noreply@example.com'}>`,
            to, subject, text, html,
        });

        console.log('Message sent: %s', info.messageId);
        
        // Log the preview URL ONLY if we are using Ethereal
        if (emailTransporter.options.host === 'smtp.ethereal.email') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = { sendEmail };