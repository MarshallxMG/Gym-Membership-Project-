# 🏋️ GymPro - Gym Membership Management System

A professional, full-featured gym membership management system with automated email notifications.

## 🌐 Live Demo

**🔗 [https://gym-membership-project-lhfv.onrender.com](https://gym-membership-project-lhfv.onrender.com)**

> ⚠️ **Note**: The site is hosted on Render's free tier. First load may take **~1 minute** to wake up the server.

---

## ✨ Features

### Admin Portal
- 📊 Dashboard with key statistics
- 👥 Member management (add, edit, delete)
- 💳 Membership plans (Monthly, Quarterly, Half-Yearly, Yearly)
- 📧 Automatic email notifications for expiring memberships
- 🔔 Notification history

### Member Portal
- 🔐 Secure login/registration
- ⏱️ Live countdown timer for membership expiry
- 🔔 In-app notifications
- 👤 Profile management
- 🔑 Password reset with OTP

### Automated Features
- ✉️ Email reminders sent automatically:
  - 5 days before expiry
  - 2 days before expiry
  - On expiry
- 📧 Both member AND admin receive notifications

---

## 🚀 Deployment Guide (Render)

### Step 1: Create Render Account
Go to [render.com](https://render.com) and create a free account.

### Step 2: Connect GitHub
1. Push this project to your GitHub
2. In Render, click **New** → **Web Service**
3. Connect your GitHub and select the repository

### Step 3: Configure Service
| Setting | Value |
|---------|-------|
| Name | `your-gym-name` |
| Root Directory | `backend` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | `Free` |

### Step 4: Environment Variables
Add these in the **Environment** section:

| Variable | Value |
|----------|-------|
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password (see below) |
| `EMAIL_FROM` | `YourGymName <your-email@gmail.com>` |

### Step 5: Gmail App Password Setup
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**
3. Go to **App Passwords**
4. Create new app password for "Mail"
5. Use the 16-character password in `EMAIL_PASS`

### Step 6: Deploy
Click **Deploy Web Service** and wait 2-3 minutes.

---

## 🔑 Default Login

### Admin Portal
- **Email**: `admin@gympro.com`
- **Password**: `admin123`

> ⚠️ **Important**: Change admin password after first login!

---

## 📁 Project Structure

```
├── backend/
│   ├── server.js          # Main server file
│   ├── database/db.js     # Database setup
│   ├── routes/           
│   │   ├── auth.js        # Authentication
│   │   ├── admin.js       # Admin API
│   │   └── user.js        # User API
│   ├── services/
│   │   ├── emailService.js      # Email templates
│   │   └── notificationService.js  # Auto notifications
│   └── .env.example       # Environment template
│
└── frontend/
    ├── index.html         # Landing page
    ├── admin/             # Admin portal
    └── user/              # Member portal
```

---

## 🛠️ Local Development

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your email credentials
npm start
```

Open http://localhost:3000

---

## 📱 Membership Plans

| Plan | Duration | Default Price |
|------|----------|---------------|
| Monthly | 30 days | ₹1,500 |
| Quarterly | 90 days | ₹4,000 |
| Half-Yearly | 180 days | ₹7,000 |
| Yearly | 365 days | ₹12,000 |

> Prices can be customized when creating memberships.

---

## 🔧 Customization

### Change Admin Credentials
Edit `backend/database/db.js` line 73-82

### Change Gym Name/Branding
Edit `frontend/index.html` and other HTML files

### Modify Email Templates
Edit `backend/services/emailService.js`

---

## 📞 Support

For technical support, contact the developer.

---

**Built with ❤️ for Fitness**
