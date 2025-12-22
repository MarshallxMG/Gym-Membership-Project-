const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'gym_membership.db');
let db;

function getDatabase() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

async function initializeDatabase() {
    const database = getDatabase();

    // Create admins table
    database.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create users table
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create memberships table
    database.exec(`
        CREATE TABLE IF NOT EXISTS memberships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status TEXT DEFAULT 'active',
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create notifications table
    database.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            membership_id INTEGER,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'expiry_warning',
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL
        )
    `);

    // Seed default admin if not exists
    const adminExists = database.prepare('SELECT id FROM admins WHERE email = ?').get('admin@gympro.com');
    
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        database.prepare(`
            INSERT INTO admins (username, email, password_hash) 
            VALUES (?, ?, ?)
        `).run('GymPro Admin', 'admin@gympro.com', hashedPassword);
        console.log('✅ Default admin created (admin@gympro.com / admin123)');
    }

    // Demo data seeding disabled - start with clean database
    // const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get();
    // if (userCount.count === 0) {
    //     await seedDemoData(database);
    // }

    return database;
}

async function seedDemoData(database) {
    console.log('📦 Seeding demo data...');

    // Create demo users
    const demoUsers = [
        { name: 'Manas Garg', email: 'manasgarg978@gmail.com', phone: '+919876543210', password: 'cifer4567' }
    ];

    for (const user of demoUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        database.prepare(`
            INSERT INTO users (name, email, phone, password_hash) 
            VALUES (?, ?, ?, ?)
        `).run(user.name, user.email, user.phone, hashedPassword);
    }

    // Create demo memberships
    const today = new Date();
    const memberships = [
        { 
            user_id: 1, 
            plan_type: 'Monthly', 
            start_date: formatDate(new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000)),
            end_date: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)), // Expires in 5 days
            amount: 1500 
        }
    ];

    for (const membership of memberships) {
        database.prepare(`
            INSERT INTO memberships (user_id, plan_type, start_date, end_date, amount) 
            VALUES (?, ?, ?, ?, ?)
        `).run(membership.user_id, membership.plan_type, membership.start_date, membership.end_date, membership.amount);
    }

    console.log('✅ Demo data seeded successfully');
    console.log('   Test user: manasgarg978@gmail.com (password: cifer4567)');
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

module.exports = { getDatabase, initializeDatabase };
