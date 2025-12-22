const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin);

// Get dashboard statistics
router.get('/dashboard', (req, res) => {
    try {
        const db = getDatabase();
        
        const totalMembers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const activeMemberships = db.prepare(`
            SELECT COUNT(*) as count FROM memberships 
            WHERE status = 'active' AND end_date >= date('now')
        `).get().count;
        const expiringMemberships = db.prepare(`
            SELECT COUNT(*) as count FROM memberships 
            WHERE status = 'active' AND end_date BETWEEN date('now') AND date('now', '+7 days')
        `).get().count;
        const totalRevenue = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM memberships
        `).get().total;
        const recentNotifications = db.prepare(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE created_at >= date('now', '-7 days')
        `).get().count;

        res.json({
            totalMembers,
            activeMemberships,
            expiringMemberships,
            totalRevenue,
            recentNotifications
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get all members
router.get('/members', (req, res) => {
    try {
        const db = getDatabase();
        const members = db.prepare(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at,
                   m.id as membership_id, m.plan_type, m.start_date, m.end_date, m.status, m.amount
            FROM users u
            LEFT JOIN memberships m ON u.id = m.user_id
            ORDER BY u.created_at DESC
        `).all();

        res.json(members);
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// Get single member
router.get('/members/:id', (req, res) => {
    try {
        const db = getDatabase();
        const member = db.prepare(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at
            FROM users u WHERE u.id = ?
        `).get(req.params.id);

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        const memberships = db.prepare(`
            SELECT * FROM memberships WHERE user_id = ? ORDER BY created_at DESC
        `).all(req.params.id);

        res.json({ ...member, memberships });
    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({ error: 'Failed to fetch member' });
    }
});

// Add new member
router.post('/members', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const db = getDatabase();

        // Check if user already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (name, email, phone, password_hash) 
            VALUES (?, ?, ?, ?)
        `).run(name, email, phone || null, hashedPassword);

        res.status(201).json({
            success: true,
            message: 'Member added successfully',
            member: {
                id: result.lastInsertRowid,
                name,
                email,
                phone
            }
        });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Update member
router.put('/members/:id', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const db = getDatabase();

        const member = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Check email uniqueness if changing email
        if (email) {
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
                .get(email, req.params.id);
            if (emailExists) {
                return res.status(409).json({ error: 'Email already in use' });
            }
        }

        let updateQuery = 'UPDATE users SET ';
        const updates = [];
        const params = [];

        if (name) { updates.push('name = ?'); params.push(name); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateQuery += updates.join(', ') + ' WHERE id = ?';
        params.push(req.params.id);

        db.prepare(updateQuery).run(...params);

        res.json({ success: true, message: 'Member updated successfully' });
    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// Delete member
router.delete('/members/:id', (req, res) => {
    try {
        const db = getDatabase();
        
        const member = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

        res.json({ success: true, message: 'Member deleted successfully' });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// Get all memberships
router.get('/memberships', (req, res) => {
    try {
        const db = getDatabase();
        const memberships = db.prepare(`
            SELECT m.*, u.name as user_name, u.email as user_email
            FROM memberships m
            JOIN users u ON m.user_id = u.id
            ORDER BY m.end_date ASC
        `).all();

        res.json(memberships);
    } catch (error) {
        console.error('Get memberships error:', error);
        res.status(500).json({ error: 'Failed to fetch memberships' });
    }
});

// Create membership for user
router.post('/memberships', (req, res) => {
    try {
        const { user_id, plan_type, start_date, end_date, amount } = req.body;

        if (!user_id || !plan_type || !start_date || !end_date || !amount) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const db = getDatabase();

        // Verify user exists
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Deactivate any existing active membership
        db.prepare(`
            UPDATE memberships SET status = 'expired' 
            WHERE user_id = ? AND status = 'active'
        `).run(user_id);

        const result = db.prepare(`
            INSERT INTO memberships (user_id, plan_type, start_date, end_date, amount, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        `).run(user_id, plan_type, start_date, end_date, amount);

        res.status(201).json({
            success: true,
            message: 'Membership created successfully',
            membership: {
                id: result.lastInsertRowid,
                user_id,
                plan_type,
                start_date,
                end_date,
                amount,
                status: 'active'
            }
        });
    } catch (error) {
        console.error('Create membership error:', error);
        res.status(500).json({ error: 'Failed to create membership' });
    }
});

// Update membership
router.put('/memberships/:id', (req, res) => {
    try {
        const { plan_type, start_date, end_date, amount, status } = req.body;
        const db = getDatabase();

        const membership = db.prepare('SELECT id FROM memberships WHERE id = ?').get(req.params.id);
        if (!membership) {
            return res.status(404).json({ error: 'Membership not found' });
        }

        let updateQuery = 'UPDATE memberships SET ';
        const updates = [];
        const params = [];

        if (plan_type) { updates.push('plan_type = ?'); params.push(plan_type); }
        if (start_date) { updates.push('start_date = ?'); params.push(start_date); }
        if (end_date) { updates.push('end_date = ?'); params.push(end_date); }
        if (amount) { updates.push('amount = ?'); params.push(amount); }
        if (status) { updates.push('status = ?'); params.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateQuery += updates.join(', ') + ' WHERE id = ?';
        params.push(req.params.id);

        db.prepare(updateQuery).run(...params);

        res.json({ success: true, message: 'Membership updated successfully' });
    } catch (error) {
        console.error('Update membership error:', error);
        res.status(500).json({ error: 'Failed to update membership' });
    }
});

// Get all notifications
router.get('/notifications', (req, res) => {
    try {
        const db = getDatabase();
        const notifications = db.prepare(`
            SELECT n.*, u.name as user_name, u.email as user_email
            FROM notifications n
            JOIN users u ON n.user_id = u.id
            ORDER BY n.created_at DESC
            LIMIT 100
        `).all();

        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Manually trigger notification check
router.post('/notifications/check', async (req, res) => {
    try {
        const { checkExpiringMemberships } = require('../services/notificationService');
        const count = await checkExpiringMemberships();
        res.json({ success: true, message: `Checked memberships, ${count} notifications sent` });
    } catch (error) {
        console.error('Notification check error:', error);
        res.status(500).json({ error: 'Failed to check notifications' });
    }
});

module.exports = router;
