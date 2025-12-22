const nodemailer = require('nodemailer');

// Email transporter configuration
let transporter = null;

function getTransporter() {
    if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('✅ Email service configured');
    }
    return transporter;
}

// Send membership expiry email to USER
async function sendExpiryEmail(userEmail, userName, membership, timeRemaining, isTestMode = false) {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
        console.log('⚠️ Email not configured - skipping email to', userEmail);
        return false;
    }

    const timeUnit = isTestMode ? 'minutes' : 'days';
    let subject, urgencyColor;
    
    if (timeRemaining <= (isTestMode ? 2 : 1)) {
        subject = `⚠️ URGENT: Your Gym Membership Expires in ${timeRemaining} ${timeUnit}!`;
        urgencyColor = '#e53e3e';
    } else if (timeRemaining <= (isTestMode ? 5 : 3)) {
        subject = `🔔 Reminder: Gym Membership Expires in ${timeRemaining} ${timeUnit}`;
        urgencyColor = '#ed8936';
    } else {
        subject = `📅 Heads Up: Gym Membership Expires in ${timeRemaining} ${timeUnit}`;
        urgencyColor = '#667eea';
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏋️ GymPro</h1>
                ${isTestMode ? '<p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px;">TEST MODE</p>' : ''}
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Hello ${userName}! 👋</h2>
                
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                    This is a <strong>reminder</strong> that your <strong>${membership.plan_type}</strong> membership 
                    <strong style="color: ${urgencyColor};">expires in ${timeRemaining} ${timeUnit}</strong>.
                </p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666;">Plan:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${membership.plan_type}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Expiry:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${membership.end_date}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Time Left:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${urgencyColor};">${timeRemaining} ${timeUnit}</td></tr>
                    </table>
                </div>
                
                <p style="color: #555; font-size: 16px;">Please renew your membership to continue enjoying our facilities!</p>
            </div>
            
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                This is an automated reminder from GymPro.
            </p>
        </div>
    </body>
    </html>
    `;

    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: userEmail,
            subject: subject,
            html: htmlContent
        });
        console.log(`📧 [USER] Email sent to ${userName} (${userEmail})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${userEmail}:`, error.message);
        return false;
    }
}

// Send notification email to ADMIN about expiring membership
async function sendAdminNotificationEmail(adminEmail, userName, userEmail, membership, timeRemaining, isTestMode = false) {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
        console.log('⚠️ Email not configured - skipping admin notification');
        return false;
    }

    const timeUnit = isTestMode ? 'minutes' : 'days';
    const subject = `📋 Membership Expiring: ${userName} - ${timeRemaining} ${timeUnit} left`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f87171 0%, #dc2626 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏋️ GymPro Admin</h1>
                ${isTestMode ? '<p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px;">TEST MODE</p>' : ''}
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">⚠️ Membership Expiring Soon</h2>
                
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                    A member's subscription is about to expire. Here are the details:
                </p>
                
                <div style="background: #fff3f3; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f87171;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Member Name:</td><td style="padding: 8px 0; text-align: right;">${userName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Email:</td><td style="padding: 8px 0; text-align: right;">${userEmail}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Plan:</td><td style="padding: 8px 0; text-align: right;">${membership.plan_type}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Expiry Date:</td><td style="padding: 8px 0; text-align: right;">${membership.end_date}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Time Remaining:</td><td style="padding: 8px 0; text-align: right; color: #f87171; font-weight: bold;">${timeRemaining} ${timeUnit}</td></tr>
                    </table>
                </div>
                
                <p style="color: #555; font-size: 16px;">Consider reaching out to the member to discuss renewal options.</p>
            </div>
            
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                GymPro Admin Notification System
            </p>
        </div>
    </body>
    </html>
    `;

    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: adminEmail,
            subject: subject,
            html: htmlContent
        });
        console.log(`📧 [ADMIN] Notification sent about ${userName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send admin notification:`, error.message);
        return false;
    }
}

// Send membership expired email
async function sendExpiredEmail(userEmail, userName, membership) {
    const emailTransporter = getTransporter();
    if (!emailTransporter) return false;

    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: userEmail,
            subject: '❌ Your Gym Membership Has Expired',
            html: `<p>Hello ${userName}, your ${membership.plan_type} membership has expired. Please renew to continue.</p>`
        });
        console.log(`📧 Expiry email sent to ${userName} (${userEmail})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send expiry email to ${userEmail}:`, error.message);
        return false;
    }
}

module.exports = { sendExpiryEmail, sendAdminNotificationEmail, sendExpiredEmail, getTransporter };
