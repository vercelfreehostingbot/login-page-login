# 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 🚀

> **Production-Ready Telegram Webhook Bot for deploying and managing web projects on Vercel via GitHub and Firebase.**

Telegram Bot: **[@Vercel_Free_Hosting_Bot](https://t.me/Vercel_Free_Hosting_Bot)**  
Super Admin Telegram ID: `6919025708`

---

## 1. Project Overview

**𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧** allows users to deploy web projects (Next.js, Vite, React, Vue, Astro, HTML/CSS, Node.js) directly to Vercel via Telegram.

### Key Architecture & Principles
- **No Web Dashboard / No Admin Web Panel**: All control is managed directly inside Telegram using Reply & Inline keyboards.
- **Vercel Serverless Webhook**: Fully compatible with Vercel Serverless Functions (`/api/telegram/webhook`). No long-polling required.
- **Zip Slip & Path Traversal Guard**: Automated archive sanitization, root directory resolution, and secret file filtering (`.env`, `.env.local`, credentials).
- **GitHub REST Integration**: Automated Git Trees & Commit API creation under `GITHUB_USERNAME`.
- **Firebase Firestore Durable State**: Stores user records, daily quota (5/day), custom domains, and conversational state machines across serverless executions.

---

## 2. Required Software & Accounts

- **Node.js 18+** & **npm**
- **Telegram Account** (to create bot via [@BotFather](https://t.me/BotFather))
- **GitHub Account** (with Personal Access Token)
- **Vercel Account** (with API Access Token)
- **Firebase Project** (Firestore Database & Service Account credentials)

---

## 3. Telegram Bot Creation

1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot`.
3. Choose a name: `Vercel Free Hosting Bot`.
4. Choose a username: `Vercel_Free_Hosting_Bot` (or your custom bot username).
5. Copy the generated **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

---

## 4. Bot Token Setup

Add your bot token to your `.env` or Vercel Environment Variables:
```env
BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
BOT_USERNAME="Vercel_Free_Hosting_Bot"
TELEGRAM_WEBHOOK_SECRET="your_custom_secret_key"
```

---

## 5. Channel & Group Force Join Setup

To enforce the Force Join verification:
1. Create a public or private **Telegram Channel** (e.g. `@MyHostingChannel`).
2. Create a public or private **Telegram Group** (e.g. `@MyHostingGroup`).
3. Add your Bot as an **Administrator** in both the Channel and Group with invite/member management permissions.

---

## 6. Finding Channel ID & Group ID

To get the exact numeric chat IDs:
1. Forward a message from your Channel / Group to [@userinfobot](https://t.me/userinfobot) or [@JsonDumpBot](https://t.me/JsonDumpBot).
2. Channel & Supergroup IDs typically begin with `-100` (e.g., `-1001928374650`).
3. Set them in your environment:
```env
CHANNEL_ID="-1001928374650"
GROUP_ID="-1001827364510"
CHANNEL_USERNAME="MyHostingChannel"
GROUP_USERNAME="MyHostingGroup"
```

---

## 7. Firebase Firestore Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g. `vercel-hosting-bot`).
3. Go to **Build > Firestore Database** and click **Create Database** (Start in production mode).
4. Go to **Project Settings > Service Accounts**.
5. Click **Generate new private key** and download the JSON file.
6. Extract the fields into your environment:
```env
FIREBASE_PROJECT_ID="vercel-hosting-bot"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@vercel-hosting-bot.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBA...=\n-----END PRIVATE KEY-----"
```

---

## 8. GitHub Token Setup

1. Go to GitHub **Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Check permissions: `repo` (Full control of private and public repositories), `workflow`, `delete_repo`.
4. Copy the token:
```env
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxx"
GITHUB_USERNAME="your-github-username"
```

---

## 9. Vercel Token Setup

1. Go to [Vercel Account Settings > Tokens](https://vercel.com/account/tokens).
2. Click **Create Token**.
3. Select Scope: Full Account Access (or selected Team).
4. Copy the token:
```env
VERCEL_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxx"
# Optional Team ID:
VERCEL_TEAM_ID=""
```

---

## 10. Environment Variables Summary (`.env`)

```env
# 1. Telegram
BOT_TOKEN="your_telegram_bot_token"
BOT_USERNAME="Vercel_Free_Hosting_Bot"
TELEGRAM_WEBHOOK_SECRET="secure_random_string"

# 2. Force Join Channels
CHANNEL_ID="-1001234567890"
GROUP_ID="-1009876543210"
CHANNEL_USERNAME="YourChannel"
GROUP_USERNAME="YourGroup"

# 3. GitHub
GITHUB_TOKEN="ghp_your_github_token"
GITHUB_USERNAME="your_github_username"

# 4. Vercel
VERCEL_TOKEN="your_vercel_token"
VERCEL_TEAM_ID=""

# 5. Firebase Admin
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# 6. Admin & URL
SUPER_ADMIN_ID="6919025708"
APP_URL="https://your-bot-domain.vercel.app"
```

---

## 11. Local Development & Deployment

### Local Testing:
```bash
npm install
npm run dev
```

### Deploying to Vercel:
1. Push this repository to GitHub.
2. Import repository in [Vercel Dashboard](https://vercel.com/new).
3. Add all Environment Variables in Vercel Project Settings.
4. Click **Deploy**.

---

## 12. Telegram Webhook Setup

Once deployed on Vercel (e.g. `https://my-hosting-bot.vercel.app`):

### Option A: Via Web Status Tool
Open your deployed website `https://my-hosting-bot.vercel.app` and click **Sync Webhook**.

### Option B: Via cURL
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://my-hosting-bot.vercel.app/api/telegram/webhook",
       "secret_token": "<YOUR_SECRET_TOKEN>",
       "drop_pending_updates": true
     }'
```

---

## 13. Bot Features & Commands

### User Commands & Buttons
- `/start`: Starts bot, validates membership via Force Join, and registers user in Firebase.
- **🚀 Deploy Website**: Prompts user to upload `.zip` archive, runs project analysis, prompts for project name, creates GitHub repo, triggers Vercel build, and sends live URL.
- **📂 My Projects**: Lists user's active projects with details and live links.
- **🌐 Add Domain**: Binds a custom domain via Vercel REST API and provides DNS A/CNAME records.
- **🔄 Redeploy**: Initiates a fresh Vercel build for an existing project.
- **🗑 Delete Project**: Permanently removes deployment from Vercel, GitHub, and Firebase after confirmation.
- **📊 My Usage**: Displays daily deployments count (5 free builds daily with automatic midnight reset).
- **👤 My Account**: Shows user info, joined date, and active projects count.
- **ℹ️ Help**: Usage guidelines and supported frameworks.

### Admin Panel (`/admin` for Super Admin: `6919025708`)
- **📊 Statistics**: Total users, total projects, active count, today's builds, and database status.
- **👥 Users**: Paginated list of registered users.
- **🌍 All Projects**: Overview of all deployed web projects across the platform.
- **🔎 Search User**: Inspect user details and project list by Telegram ID.
- **🚫 Ban / ✅ Unban User**: Manage user suspension.
- **🔄 Reset Limit**: Reset a user's daily deployment count.
- **📢 Broadcast**: Broadcast messages to all registered users.
- **📜 System Logs**: View live system action logs.
- **➕ Add / ❌ Remove Admin**: Super Admin delegation.

---

## 14. Testing & Verification Checklist

- [x] `/start` command triggers Force Join check
- [x] ✅ Verify button uses `getChatMember`
- [x] Reply Keyboard loads with all required buttons
- [x] ZIP file upload validation (Rejects non-zip files)
- [x] Zip Slip & Path Traversal protection
- [x] Framework auto-detection (Next.js, Vite, React, Astro, Static)
- [x] Project name normalization & duplicate prevention
- [x] GitHub repository creation and Git blob uploads
- [x] Vercel project creation & deployment build monitoring
- [x] Single progress message live editing
- [x] Success message with live HTTPS URL & action buttons
- [x] 5 builds/day limit enforcement and auto-reset
- [x] Custom domain binding & DNS instructions
- [x] Ownership security check on all actions
- [x] Super Admin access lock (`6919025708`)
- [x] Webhook endpoint `/api/telegram/webhook` response

---

## 15. License

MIT License — Built for **𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧**.
