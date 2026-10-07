const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure data and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const FLOWS_FILE = path.join(DATA_DIR, 'flows.json');
const QUICK_REPLIES_FILE = path.join(DATA_DIR, 'quick_replies.json');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Default initial data
const defaultSettings = {
  brandName: "WhatsApp Business",
  brandStatus: "Online",
  brandSubtitle: "Official Business Account",
  brandAvatar: "/assets/whatsapp-business.svg",
  botActive: true,
  soundEnabled: true,
  phonePromptEnabled: true,
  phonePromptMessage: "💬 In case our chat gets interrupted, please share your WhatsApp or Mobile number so we can reach you:",
  phonePromptDelay: 12, // seconds
  autoWelcome: true,
  welcomeDelay: 2, // seconds before starting welcome flow
  fallbackMessage: "Thanks for your message! Our specialist is reviewing your inquiry and will reply in a moment. You can also pick an option below 👇",
  adminPin: "1234"
};

const defaultQuickReplies = [
  {
    id: "qr_cod",
    label: "📦 Cash on Delivery Available?",
    flowId: "flow_cod",
    order: 1
  },
  {
    id: "qr_price",
    label: "🔥 Special Discount & Price",
    flowId: "flow_pricing",
    order: 2
  },
  {
    id: "qr_order",
    label: "⚡ Order Now (Fast Delivery)",
    flowId: "flow_order",
    order: 3
  },
  {
    id: "qr_agent",
    label: "👤 Speak with Live Agent",
    flowId: "flow_agent",
    order: 4
  }
];

const defaultFlows = [
  {
    id: "flow_welcome",
    name: "👋 Welcome Funnel (New Visitors)",
    triggerType: "welcome",
    keywords: ["hi", "hello", "hey", "start", "salam", "menu"],
    enabled: true,
    steps: [
      {
        id: "step_w1",
        delay: 2,
        type: "text",
        content: "Hey there! 👋 Welcome to our official store.\n\nThank you for checking out our special offer from Facebook/TikTok! How can I assist you today?",
        caption: ""
      },
      {
        id: "step_w2",
        delay: 3,
        type: "voice",
        content: "/uploads/sample-greeting.wav",
        caption: "",
        voiceDuration: 3
      },
      {
        id: "step_w3",
        delay: 4,
        type: "text",
        content: "We have an ongoing FLASH SALE ending tonight: **50% OFF + Free Cash on Delivery** 🎁\n\nTap any quick button below to see details or place an instant order:",
        caption: ""
      }
    ]
  },
  {
    id: "flow_cod",
    name: "📦 Cash on Delivery (COD) Inquiries",
    triggerType: "quick_reply",
    keywords: ["cod", "cash on delivery", "cash", "delivery", "pay later"],
    enabled: true,
    steps: [
      {
        id: "step_cod1",
        delay: 2,
        type: "text",
        content: "Yes! 100% Cash on Delivery (COD) is available nationwide! 🚚✨\n\nYou do NOT need to pay anything in advance. You can inspect your parcel upon arrival and pay cash directly to the rider.",
        caption: ""
      },
      {
        id: "step_cod2",
        delay: 3,
        type: "image",
        content: "/assets/cod-guarantee.svg",
        caption: "✅ Open & inspect your parcel upon arrival before paying the courier rider!"
      },
      {
        id: "step_cod3",
        delay: 4,
        type: "text",
        content: "Delivery is typically within 24 to 48 hours with door-to-door tracking. Would you like to reserve yours with today's free delivery guarantee? Drop your delivery city or phone number below! 👇",
        caption: ""
      }
    ]
  },
  {
    id: "flow_pricing",
    name: "🔥 Pricing & Packages Funnel",
    triggerType: "quick_reply",
    keywords: ["price", "cost", "how much", "rate", "discount", "offer", "package"],
    enabled: true,
    steps: [
      {
        id: "step_pr1",
        delay: 2,
        type: "text",
        content: "🎉 Today's Limited-Time Promotional Bundles:\n\n⭐ **1 Unit:** $29 (Regular $45) - Free Shipping\n🔥 **2 Units (Most Popular):** $49 only (Save $41 + Free Bonus Gift!)\n💎 **3 Units (Family Pack):** $65 (Save 60%)\n\nAll packages include 1-Year Guarantee & Free Return Protection! 🛡️",
        caption: ""
      },
      {
        id: "step_pr2",
        delay: 4,
        type: "text",
        content: "Which package suits you best? Reply with **1, 2, or 3** or click 'Order Now' to lock in this promotional price! ⏳",
        caption: ""
      }
    ]
  },
  {
    id: "flow_order",
    name: "⚡ Instant Order Checkout Flow",
    triggerType: "quick_reply",
    keywords: ["order", "buy", "purchase", "checkout", "book", "deliver"],
    enabled: true,
    steps: [
      {
        id: "step_ord1",
        delay: 2,
        type: "text",
        content: "Awesome decision! 🚀 Let's get your order dispatched right away.\n\nPlease reply with your delivery details:\n\n1. Full Name:\n2. Phone / WhatsApp Number:\n3. Complete Delivery Address:\n4. Selected Package (1, 2, or 3 units):",
        caption: ""
      },
      {
        id: "step_ord2",
        delay: 4,
        type: "text",
        content: "Once you send these details, our fulfillment warehouse will pack your order and send your tracking code! 📦",
        caption: ""
      }
    ]
  },
  {
    id: "flow_agent",
    name: "👤 Live Agent Escalation",
    triggerType: "quick_reply",
    keywords: ["agent", "human", "talk", "representative", "call", "support"],
    enabled: true,
    steps: [
      {
        id: "step_ag1",
        delay: 2,
        type: "text",
        content: "I've alerted our senior customer support team right now! 🔔\n\nA human specialist has been assigned to your chat and will reply momentarily. Please feel free to ask your specific question here.",
        caption: ""
      }
    ]
  }
];

// Helper to safely read JSON
function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

// Helper to safely write JSON atomically
function writeJSON(filePath, data) {
  try {
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error(`Fallback direct write failed for ${filePath}:`, e);
      return false;
    }
  }
}

class Storage {
  constructor() {
    this.init();
  }

  init() {
    this.settings = readJSON(SETTINGS_FILE, defaultSettings);
    this.flows = readJSON(FLOWS_FILE, defaultFlows);
    this.quickReplies = readJSON(QUICK_REPLIES_FILE, defaultQuickReplies);
    this.visitors = readJSON(VISITORS_FILE, {});
    this.messages = readJSON(MESSAGES_FILE, []);
  }

  // --- Settings ---
  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    writeJSON(SETTINGS_FILE, this.settings);
    return this.settings;
  }

  // --- Flows ---
  getFlows() {
    return [...this.flows];
  }

  getFlowById(id) {
    return this.flows.find(f => f.id === id);
  }

  saveFlow(flowData) {
    const index = this.flows.findIndex(f => f.id === flowData.id);
    if (index >= 0) {
      this.flows[index] = { ...this.flows[index], ...flowData };
    } else {
      this.flows.push(flowData);
    }
    writeJSON(FLOWS_FILE, this.flows);
    return flowData;
  }

  deleteFlow(id) {
    this.flows = this.flows.filter(f => f.id !== id);
    writeJSON(FLOWS_FILE, this.flows);
    return true;
  }

  // Find matching flow by keyword
  findFlowByKeyword(text) {
    if (!text) return null;
    const clean = text.trim().toLowerCase();
    
    // Check quick replies matching label
    const qrMatch = this.quickReplies.find(qr => qr.label.toLowerCase() === clean);
    if (qrMatch && qrMatch.flowId) {
      const flow = this.getFlowById(qrMatch.flowId);
      if (flow && flow.enabled) return flow;
    }

    // Check keyword matching across enabled flows
    for (const flow of this.flows) {
      if (!flow.enabled || !flow.keywords) continue;
      for (const kw of flow.keywords) {
        const kwLower = kw.trim().toLowerCase();
        if (kwLower && (clean === kwLower || clean.includes(kwLower))) {
          return flow;
        }
      }
    }
    return null;
  }

  // --- Quick Replies ---
  getQuickReplies() {
    return [...this.quickReplies].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  saveQuickReplies(replies) {
    this.quickReplies = replies;
    writeJSON(QUICK_REPLIES_FILE, this.quickReplies);
    return this.quickReplies;
  }

  // --- Visitors ---
  getVisitors() {
    return Object.values(this.visitors).sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
  }

  getVisitor(visitorId) {
    return this.visitors[visitorId] || null;
  }

  saveVisitor(visitorData) {
    const existing = this.visitors[visitorData.id] || {};
    this.visitors[visitorData.id] = {
      ...existing,
      ...visitorData,
      lastActive: new Date().toISOString()
    };
    writeJSON(VISITORS_FILE, this.visitors);
    return this.visitors[visitorData.id];
  }

  updateVisitorPhone(visitorId, phone) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].phone = phone;
      this.visitors[visitorId].lastActive = new Date().toISOString();
      writeJSON(VISITORS_FILE, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  setBotPaused(visitorId, paused) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].botPaused = paused;
      writeJSON(VISITORS_FILE, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  resetUnread(visitorId) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].unreadCount = 0;
      writeJSON(VISITORS_FILE, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  incrementUnread(visitorId) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].unreadCount = (this.visitors[visitorId].unreadCount || 0) + 1;
      writeJSON(VISITORS_FILE, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  // --- Messages ---
  getMessages(visitorId) {
    return this.messages.filter(m => m.visitorId === visitorId);
  }

  addMessage(msg) {
    const newMsg = {
      id: msg.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      visitorId: msg.visitorId,
      sender: msg.sender, // 'visitor', 'bot', 'admin', 'system'
      type: msg.type || 'text', // 'text', 'voice', 'image', 'video', 'system'
      content: msg.content || '',
      caption: msg.caption || '',
      voiceDuration: msg.voiceDuration || 0,
      timestamp: msg.timestamp || new Date().toISOString(),
      status: msg.status || 'delivered' // 'sent', 'delivered', 'read'
    };
    this.messages.push(newMsg);
    
    // Update visitor snippet
    if (this.visitors[msg.visitorId]) {
      this.visitors[msg.visitorId].lastMessage = newMsg.content 
        ? (newMsg.type === 'voice' ? '🎤 Voice note' : (newMsg.type === 'image' ? '📷 Photo' : (newMsg.type === 'video' ? '🎥 Video' : newMsg.content)))
        : 'Attachment';
      this.visitors[msg.visitorId].lastActive = newMsg.timestamp;
      writeJSON(VISITORS_FILE, this.visitors);
    }

    writeJSON(MESSAGES_FILE, this.messages);
    return newMsg;
  }

  markMessagesRead(visitorId, sender = 'visitor') {
    let changed = false;
    for (const m of this.messages) {
      if (m.visitorId === visitorId && m.sender === sender && m.status !== 'read') {
        m.status = 'read';
        changed = true;
      }
    }
    if (changed) {
      writeJSON(MESSAGES_FILE, this.messages);
    }
    return true;
  }

  clearConversation(visitorId) {
    this.messages = this.messages.filter(m => m.visitorId !== visitorId);
    writeJSON(MESSAGES_FILE, this.messages);
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].lastMessage = '';
      this.visitors[visitorId].unreadCount = 0;
      writeJSON(VISITORS_FILE, this.visitors);
    }
    return true;
  }

  deleteVisitor(visitorId) {
    if (this.visitors[visitorId]) {
      delete this.visitors[visitorId];
      writeJSON(VISITORS_FILE, this.visitors);
    }
    this.messages = this.messages.filter(m => m.visitorId !== visitorId);
    writeJSON(MESSAGES_FILE, this.messages);
    return true;
  }
}

const storage = new Storage();
module.exports = storage;
