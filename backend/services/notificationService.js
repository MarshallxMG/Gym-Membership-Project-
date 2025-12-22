require('dotenv').config();

const cron = require('node-cron');
const { getDatabase } = require('../database/db');
const { sendExpiryEmail, sendAdminNotificationEmail } = require('./emailService');

// Admin email for notifications
const ADMIN_EMAIL = process.env.EMAIL_USER;

// Check for expiring memberships and create notifications + send emails
async function checkExpiringMemberships() {
    try {
        const db = getDatabase();
        const now = new Date();
        
        // Get all active memberships
        const activeMemberships = db.prepare(`
            SELECT m.*, u.name as user_name, u.email as user_email
            FROM memberships m
            JOIN users u ON m.user_id = u.id
            WHERE m.status = 'active'
        `).all();

        let notificationCount = 0;

        for (const membership of activeMemberships) {
            const endDate = new Date(membership.end_date);
            const timeDiff = endDate - now;
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let shouldNotify = false;
            let notificationType = '';
            let isExpired = false;
            
            // Check if membership has EXPIRED
            if (daysRemaining <= 0) {
                const existing = db.prepare(`
                    SELECT id FROM notifications 
                    WHERE membership_id = ? AND type = 'expired'
                `).get(membership.id);
                
                if (!existing) {
                    shouldNotify = true;
                    notificationType = 'expired';
                    isExpired = true;
                    
                    // Mark membership as expired
                    db.prepare('UPDATE memberships SET status = ? WHERE id = ?').run('expired', membership.id);
                    console.log(`📛 Membership ${membership.id} marked as EXPIRED`);
                }
            }
            // 5-day reminder (4-6 days remaining)
            else if (daysRemaining >= 4 && daysRemaining <= 6) {
                const existing = db.prepare(`
                    SELECT id FROM notifications 
                    WHERE membership_id = ? AND type = 'warning_5day'
                `).get(membership.id);
                
                if (!existing) {
                    shouldNotify = true;
                    notificationType = 'warning_5day';
                }
            }
            // 2-day reminder (1-3 days remaining)
            else if (daysRemaining >= 1 && daysRemaining <= 3) {
                const existing = db.prepare(`
                    SELECT id FROM notifications 
                    WHERE membership_id = ? AND type = 'warning_2day'
                `).get(membership.id);
                
                if (!existing) {
                    shouldNotify = true;
                    notificationType = 'warning_2day';
                }
            }
            
            if (!shouldNotify) continue;
            
            // Create message
            let message;
            if (isExpired) {
                message = `❌ Your ${membership.plan_type} membership has EXPIRED! Please renew to continue.`;
            } else {
                message = `⚠️ Your ${membership.plan_type} membership expires in ${daysRemaining} day(s)!`;
            }

            // Create in-app notification
            db.prepare(`
                INSERT INTO notifications (user_id, membership_id, message, type)
                VALUES (?, ?, ?, ?)
            `).run(membership.user_id, membership.id, message, notificationType);

            // Send email to USER
            await sendExpiryEmail(
                membership.user_email,
                membership.user_name,
                membership,
                isExpired ? 0 : daysRemaining,
                false
            );

            // Send email to ADMIN
            await sendAdminNotificationEmail(
                ADMIN_EMAIL,
                membership.user_name,
                membership.user_email,
                membership,
                isExpired ? 0 : daysRemaining,
                false
            );

            notificationCount++;
            const status = isExpired ? '❌ EXPIRED' : `⏰ ${daysRemaining} day(s) left`;
            console.log(`📧 ${membership.user_name}: ${status}`);
        }

        return notificationCount;
    } catch (error) {
        console.error('Error checking memberships:', error);
        return 0;
    }
}

// Start the notification scheduler
function startNotificationScheduler() {
    // Check every hour
    cron.schedule('0 * * * *', async () => {
        console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Running hourly check...`);
        const count = await checkExpiringMemberships();
        console.log(`✅ Done: ${count} notification(s) sent`);
    });
    
    console.log('🏭 PRODUCTION MODE');
    console.log('📋 Checking every hour');
    console.log('📧 Reminders: 5 days + 2 days before expiry');

    // Run immediately on server start
    console.log('🔍 Initial check...');
    checkExpiringMemberships().then(count => {
        console.log(`✅ Initial: ${count} notification(s) sent`);
    });
}

module.exports = { checkExpiringMemberships, startNotificationScheduler };
