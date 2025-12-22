const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/db');
const { verifyToken, requireUser } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication and user role
router.use(verifyToken);
router.use(requireUser);

// Get user profile
router.get('/profile', (req, res) => {
    try {
        const db = getDatabase();
        const user = db.prepare(`
            SELECT id, name, email, phone, created_at FROM users WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const { name, phone, currentPassword, newPassword } = req.body;
        const db = getDatabase();

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let updateQuery = 'UPDATE users SET ';
        const updates = [];
        const params = [];

        if (name) { updates.push('name = ?'); params.push(name); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }

        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password required to change password' });
            }
            const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updates.push('password_hash = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateQuery += updates.join(', ') + ' WHERE id = ?';
        params.push(req.user.id);

        db.prepare(updateQuery).run(...params);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get user membership
router.get('/membership', (req, res) => {
    try {
        const db = getDatabase();
        const membership = db.prepare(`
            SELECT * FROM memberships 
            WHERE user_id = ? AND status = 'active'
            ORDER BY end_date DESC LIMIT 1
        `).get(req.user.id);

        if (!membership) {
            return res.json({ 
                hasMembership: false, 
                message: 'No active membership found' 
            });
        }

        // Calculate days remaining
        const endDate = new Date(membership.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        res.json({
            hasMembership: true,
            membership: {
                ...membership,
                daysRemaining,
                isExpiring: daysRemaining <= 7,
                isExpired: daysRemaining < 0
            }
        });
    } catch (error) {
        console.error('Get membership error:', error);
        res.status(500).json({ error: 'Failed to fetch membership' });
    }
});

// Get membership history
router.get('/membership/history', (req, res) => {
    try {
        const db = getDatabase();
        const memberships = db.prepare(`
            SELECT * FROM memberships WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(req.user.id);

        res.json(memberships);
    } catch (error) {
        console.error('Get membership history error:', error);
        res.status(500).json({ error: 'Failed to fetch membership history' });
    }
});

// Get user notifications
router.get('/notifications', (req, res) => {
    try {
        const db = getDatabase();
        const notifications = db.prepare(`
            SELECT * FROM notifications WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).all(req.user.id);

        const unreadCount = db.prepare(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE user_id = ? AND is_read = 0
        `).get(req.user.id).count;

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', (req, res) => {
    try {
        const db = getDatabase();
        
        // Verify notification belongs to user
        const notification = db.prepare(`
            SELECT id FROM notifications WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.id);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', (req, res) => {
    try {
        const db = getDatabase();
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

module.exports = router;
