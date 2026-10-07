# WhatsApp-Style Live Chat & Automated Sales Funnel System
### Built specifically for Facebook & TikTok Ads Traffic 🚀

Eliminate WhatsApp number bans, skyrocket conversation-to-lead rates, and automate high-ticket / ecommerce customer conversions with an authentic, ultra-fast WhatsApp Web Clone and visual Sales Funnel Engine.

---

## 🌟 Why This Exists (The Problem Solved)
- **The Problem:** Running Facebook or TikTok Ads directly to WhatsApp phone links (`wa.me/` or WhatsApp Click-to-Chat ads) frequently results in **WhatsApp number bans**, high cost-per-acquisition, lost customer numbers, and zero control over auto-reply timing or media flows.
- **The Solution:** Send traffic to this lightweight web-based WhatsApp clone landing page.
  - Zero risk of WhatsApp number bans.
  - Sub-1.5 second loading speed on 3G/4G mobile devices.
  - Humanized delay timers (`typing...` and `recording audio...`).
  - Interactive Quick Reply chips to remove interaction friction.
  - Voice Notes, Product Images, and Video demos integrated directly in the funnel.
  - Live Admin Takeover & In-Browser Voice Note Recording.
  - Automatic Phone / WhatsApp Lead Capture with CSV Export.

---

## 🛠️ Architecture & Tech Stack
- **Backend:** Node.js + Express.js
- **Real-Time Engine:** Socket.io (bi-directional instant visitor & admin messaging)
- **Media Engine:** Multer (voice notes, product photos, video demos)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (zero heavy frameworks, instant load)
- **Storage:** Plug-and-play JSON persistence in `data/` (zero database configuration needed)
- **Audio Synthesizer:** Web Audio API (zero audio file latency for authentic WhatsApp sound effects)

---

## 📱 Modules & Core Features

### 1. Visitor Chat Interface (`/`)
- **Realistic WhatsApp Mobile UI:** Authentic WhatsApp header with live pulsating "online" indicator, verified badge, WhatsApp doodle background, message bubbles, timestamps, and double blue checkmarks.
- **Custom WhatsApp Voice Note Player:** Green waveform bars scrubber, play/pause toggle, audio duration counter, playback speed selector (`1x`, `1.5x`, `2x`), and blue mic badge.
- **Media Lightbox Viewer:** Zoomable full-screen viewer for product photos and video demos.
- **Quick Reply Chips:** Frictionless buttons at the bottom ("Cash on Delivery Available?", "Check Price & Offers", "Order Now") that trigger automated sequences on tap.
- **Human Simulation:** Dynamic header states ("typing...", "recording audio...") and animated 3-dot typing bubbles during delay countdowns.
- **Phone / Lead Capture:** Non-intrusive floating card asking for WhatsApp number in case of disconnection, plus automatic regex detection of phone numbers typed in chat.

### 2. Auto-Reply & Delay Funnel Engine
- **Configurable Delay Timers:** Individual second-level delays per step (e.g., Step 1: 2s, Step 2: 4s, Step 3: 8s).
- **Rich Formats per Step:** Text with formatting, Voice Notes, Product Images, and Videos.
- **Trigger Logic:**
  - *Welcome Flow:* Automatically greets new visitors on arrival.
  - *Quick Reply / Keyword Triggers:* Fires targeted sequences matching customer questions (COD, Pricing, Order, Support).
  - *Fallback Engine:* Responds helpfully if visitor types unmapped queries.

### 3. Admin Control Panel (`/admin`)
- **Live CRM Inbox:** Real-time visitor list with unread notification badges, online status, ad traffic source (TikTok/FB Ads), and search filter.
- **Live Takeover:** Admin can take control at any moment. Manual typing automatically pauses the bot so the agent is never interrupted.
- **In-Browser Voice Note Recorder:** Direct browser microphone recording using `MediaRecorder` API with timer, live waveform, and one-click sending or saving.
- **Visual Funnel Builder:** Create and manage multi-step sequences with custom delay timers, media uploads, and trigger keywords.
- **Quick Reply Manager:** Add, edit, or reorder visitor action buttons.
- **Brand & Bot Settings:** Customize Agent Name, Avatar, Global Bot Toggle, Lead Capture Prompts, and 1-Click CSV Lead Export.

---

## 🚀 Quick Start Guide (Local Setup)

### Prerequisites
- Node.js (v18.x or higher)
- npm (v9.x or higher)

### 1. Installation
Clone or navigate to the project directory and install dependencies:
```bash
cd "Live chat"
npm install
```

### 2. Start the Server
```bash
npm start
```
Or for auto-reloading development mode:
```bash
npm run dev
```

### 3. Access URLs
- **Visitor Chat Landing Page:** [http://localhost:3000](http://localhost:3000)
- **Admin Control Panel:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🎯 How to Use for TikTok & Facebook Ads

1. **Set Up Your Ad Campaign:**
   - On Facebook Ads Manager or TikTok Ads Manager, set your campaign objective to **Traffic** or **Leads**.
   - Point your Ad URL to your chat landing page:
     ```
     https://your-domain.com/?utm_source=tiktok_ads&campaign=flash_sale
     ```
   - The system automatically captures the visitor's UTM source and displays it in the Admin Panel.

2. **Customize Your Sales Sequence:**
   - Open `/admin` -> Navigate to **Funnel Flows**.
   - Customize the **Welcome Flow** and **Pricing Flow** with your exact product offer and discount tiers.
   - Use the **Record Audio** feature in `/admin` to record a real, friendly voice note introducing your offer. Voice notes increase conversion rates by up to 300% on TikTok/FB ads!

3. **Monitor Leads in Real Time:**
   - Keep `/admin` open on your desktop or mobile browser.
   - You will hear an audible notification chime whenever a new visitor starts chatting or enters their phone number.
   - Click **Open in Official WhatsApp Web** directly inside the Admin Panel to reach out to captured leads on WhatsApp if needed.

4. **Export Your Leads:**
   - In `/admin` -> **Settings & Leads**, click **Download Leads CSV** to export all captured names, phone numbers, and timestamps to import into your CRM, Google Sheets, or dialer software.

---

## ☁️ Free Cloud Deployment Guide

You can deploy this full-stack system completely for free in less than 5 minutes on **Render**, **Railway**, or **Fly.io**.

### Option A: Render.com (Recommended - 100% Free)
1. Push this project to a GitHub repository.
2. Sign in to [Render.com](https://render.com) and click **New +** -> **Web Service**.
3. Select your GitHub repository.
4. Set the following build and start configurations:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Render will assign you a live HTTPS URL (e.g., `https://your-app.onrender.com`).
6. Access your Visitor chat at `https://your-app.onrender.com` and admin at `https://your-app.onrender.com/admin`!

### Option B: Railway.app
1. Go to [Railway.app](https://railway.app) and create a new project.
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects `server.js` and deploys it immediately with an HTTPS domain.

---

## 📂 Project Structure
```
├── server.js               # Express, Socket.io, Multer & Auto-reply Timer Engine
├── storage.js              # Plug-and-play JSON persistence helper
├── package.json            # Project dependencies & scripts
├── data/                   # Persistent data files
│   ├── settings.json       # Brand settings & lead capture rules
│   ├── flows.json          # Funnel sequences, delays & content
│   ├── quick_replies.json  # Visitor chip buttons
│   ├── visitors.json       # Visitor sessions & captured leads
│   └── messages.json       # Chat transcripts
├── uploads/                # Media storage (voice notes, images, videos)
├── public/
│   ├── index.html          # Visitor WhatsApp Clone Landing Page
│   ├── admin.html          # Admin Dashboard & CRM
│   ├── css/
│   │   ├── chat.css        # WhatsApp styling, waveforms, mobile layout
│   │   └── admin.css       # CRM dashboard styling
│   ├── js/
│   │   ├── chat.js         # Visitor Socket.io, voice scrubber, audio synth
│   │   └── admin.js        # Admin Socket.io, mic recorder, flow builder
│   └── assets/
│       ├── default-avatar.svg
│       ├── whatsapp-bg.svg
│       └── cod-guarantee.svg
└── README.md
```

---

## 📄 License
MIT License. Free to use for personal, commercial, and client ad campaigns.
