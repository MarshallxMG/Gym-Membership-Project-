require('dotenv').config();

let twilioClient = null;

// Initialize Twilio client
function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio WhatsApp service configured');
    }
    return twilioClient;
}

// Format phone number for WhatsApp
function formatWhatsAppNumber(phone) {
    if (!phone) return null;
    
    // Remove spaces and special characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('+')) {
        // Assume India if no country code
        if (cleaned.startsWith('91')) {
            cleaned = '+' + cleaned;
        } else if (cleaned.startsWith('0')) {
            cleaned = '+91' + cleaned.substring(1);
        } else {
            cleaned = '+91' + cleaned;
        }
    }
    
    return 'whatsapp:' + cleaned;
}

// Send WhatsApp message
async function sendWhatsAppMessage(toPhone, message) {
    const client = getTwilioClient();
    
    if (!client) {
        console.log('⚠️ Twilio not configured - skipping WhatsApp');
        return { success: false, error: 'Twilio not configured' };
    }

    const fromNumber = 'whatsapp:' + (process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886');
    const toNumber = formatWhatsAppNumber(toPhone);

    if (!toNumber) {
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        const result = await client.messages.create({
            body: message,
            from: fromNumber,
            to: toNumber
        });
        
        console.log(`📱 WhatsApp sent to ${toPhone}: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error(`❌ WhatsApp failed to ${toPhone}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Send expiry reminder via WhatsApp
async function sendExpiryWhatsApp(phone, userName, membership, daysRemaining) {
    let message;
    
    if (daysRemaining <= 0) {
        message = `❌ Hi ${userName}! Your ${membership.plan_type} gym membership has EXPIRED. Please renew to continue your fitness journey! 💪`;
    } else if (daysRemaining <= 2) {
        message = `⚠️ URGENT: Hi ${userName}! Your ${membership.plan_type} membership expires in just ${daysRemaining} day(s)! Renew now to avoid interruption. 🏋️`;
    } else {
        message = `📅 Reminder: Hi ${userName}! Your ${membership.plan_type} membership expires in ${daysRemaining} days (${membership.end_date}). Visit us to renew! 💪`;
    }

    return await sendWhatsAppMessage(phone, message);
}

// Send registration OTP via WhatsApp
async function sendOTPWhatsApp(phone, otp) {
    const message = `🔐 Your GymPro verification code is: *${otp}*\n\nThis code expires in 10 minutes. Don't share it with anyone.`;
    return await sendWhatsAppMessage(phone, message);
}

module.exports = { 
    sendWhatsAppMessage, 
    sendExpiryWhatsApp, 
    sendOTPWhatsApp,
    getTwilioClient 
};
