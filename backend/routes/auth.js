const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Unified Login - checks both admin and user tables
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDatabase();

        // First check if it's an admin
        const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);

        if (admin) {
            const isValidPassword = await bcrypt.compare(password, admin.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = generateToken({
                id: admin.id,
                email: admin.email,
                username: admin.username,
                role: 'admin'
            });

            return res.json({
                success: true,
                message: 'Admin login successful',
                token,
                role: 'admin',
                user: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    role: 'admin'
                }
            });
        }

        // Check if it's a user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (user) {
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = generateToken({
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'user'
            });

            return res.json({
                success: true,
                message: 'Login successful',
                token,
                role: 'user',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: 'user'
                }
            });
        }

        // Neither admin nor user found
        return res.status(401).json({ error: 'Invalid email or password' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin Login (kept for backward compatibility)
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDatabase();
        const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);

        if (!admin) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken({
            id: admin.id,
            email: admin.email,
            username: admin.username,
            role: 'admin'
        });

        res.json({
            success: true,
            message: 'Admin login successful',
            token,
            role: 'admin',
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User Login (kept for backward compatibility)
router.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'user'
        });

        res.json({
            success: true,
            message: 'Login successful',
            token,
            role: 'user',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: 'user'
            }
        });
    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const db = getDatabase();

        // Check if email exists in users or admins
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        const existingAdmin = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
        
        if (existingUser || existingAdmin) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Format phone with +91 if not present
        let formattedPhone = phone;
        if (phone && !phone.startsWith('+')) {
            formattedPhone = '+91' + phone.replace(/^0+/, '');
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (name, email, phone, password_hash) 
            VALUES (?, ?, ?, ?)
        `).run(name, email, formattedPhone || null, hashedPassword);

        const token = generateToken({
            id: result.lastInsertRowid,
            email,
            name,
            role: 'user'
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            role: 'user',
            user: {
                id: result.lastInsertRowid,
                name,
                email,
                phone: formattedPhone || null,
                role: 'user'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Keep old endpoint for backward compatibility
router.post('/user/register', async (req, res) => {
    req.url = '/register';
    router.handle(req, res);
});

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, otp, name) {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏋️ GymPro</h1>
                <p style="color: rgba(255,255,255,0.9); margin-top: 5px;">Password Reset</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Hello ${name || 'User'}! 👋</h2>
                
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                    You requested to reset your password. Use the OTP below to proceed:
                </p>
                
                <div style="background: #f0fdf4; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center; border: 2px dashed #4ade80;">
                    <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Your OTP Code</p>
                    <h1 style="color: #22c55e; margin: 0; font-size: 42px; letter-spacing: 8px; font-family: monospace;">${otp}</h1>
                </div>
                
                <p style="color: #888; font-size: 14px;">
                    ⏰ This OTP expires in <strong>10 minutes</strong>.<br>
                    ⚠️ If you didn't request this, please ignore this email.
                </p>
            </div>
            
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                GymPro - Gym Membership Management
            </p>
        </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: '🔐 GymPro Password Reset OTP',
        html: htmlContent
    });
}

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const db = getDatabase();
        
        // Check if user exists
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({ success: true, message: 'If the email exists, an OTP has been sent' });
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP with 10-minute expiry
        otpStore.set(email, {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
            userId: user.id,
            name: user.name
        });

        // Send OTP email
        await sendOTPEmail(email, otp, user.name);
        
        console.log(`📧 OTP sent to ${email}`);
        
        res.json({ 
            success: true, 
            message: 'OTP sent to your email' 
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify OTP and Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check OTP
        const storedData = otpStore.get(email);
        
        if (!storedData) {
            return res.status(400).json({ error: 'OTP expired or invalid. Please request a new one.' });
        }

        if (storedData.expiresAt < Date.now()) {
            otpStore.delete(email);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // OTP is valid - update password
        const db = getDatabase();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hashedPassword, email);
        
        // Clear OTP
        otpStore.delete(email);
        
        console.log(`✅ Password reset successful for ${email}`);
        
        res.json({ 
            success: true, 
            message: 'Password reset successful! You can now login with your new password.' 
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
