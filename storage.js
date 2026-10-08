const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants.json');

// Ensure base directories exist
[DATA_DIR, UPLOADS_DIR, TENANTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Password Hashing Helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return password === storedHash;
  }
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// In-Memory Active Sessions Store: token -> { tenantId, username, expiresAt }
const activeSessions = new Map();

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
  phonePromptDelay: 12,
  autoWelcome: true,
  welcomeDelay: 2,
  fallbackMessage: "Thanks for your message! Our specialist is reviewing your inquiry and will reply in a moment. You can also pick an option below 👇",
  adminPin: "1234"
};

const defaultQuickReplies = [
  {
    id: "qr_cod",
    label: "📦 Cash on Delivery Available?",
    actionType: "flow",
    flowId: "flow_cod",
    order: 1
  },
  {
    id: "qr_price",
    label: "🔥 Special Discount & Price",
    actionType: "flow",
    flowId: "flow_pricing",
    order: 2
  },
  {
    id: "qr_voice",
    label: "🎤 Audio Voice Note",
    actionType: "voice",
    content: "/uploads/sample-greeting.wav",
    voiceDuration: 3,
    delay: 2,
    order: 3
  },
  {
    id: "qr_pic",
    label: "📸 Real Product Photos",
    actionType: "image",
    content: "/uploads/file-1791404933496-954088728.jpeg",
    caption: "100% Original imported product photo ✨",
    delay: 2,
    order: 4
  },
  {
    id: "qr_order",
    label: "⚡ Order Now (Fast Delivery)",
    actionType: "flow",
    flowId: "flow_order",
    order: 5
  },
  {
    id: "qr_agent",
    label: "👤 Speak with Live Agent",
    actionType: "flow",
    flowId: "flow_agent",
    order: 6
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
        type: "text",
        content: "Tap any quick option below to check cash on delivery, see parcel unboxing photos, or view today's discount price! 👇",
        caption: ""
      }
    ]
  },
  {
    id: "flow_cod",
    name: "📦 Cash on Delivery Guarantee",
    triggerType: "quick_reply",
    keywords: ["cod", "cash on delivery", "advance", "payment", "delivery time"],
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
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substr(2, 4)}.tmp`;
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

// Storage instance per Tenant
class Storage {
  constructor(dirPath = DATA_DIR, tenantId = 'default') {
    this.dirPath = dirPath;
    this.tenantId = tenantId;

    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }

    this.settingsFile = path.join(this.dirPath, 'settings.json');
    this.flowsFile = path.join(this.dirPath, 'flows.json');
    this.quickRepliesFile = path.join(this.dirPath, 'quick_replies.json');
    this.visitorsFile = path.join(this.dirPath, 'visitors.json');
    this.messagesFile = path.join(this.dirPath, 'messages.json');
    this.authFile = path.join(this.dirPath, 'auth.json');

    this.init();
  }

  init() {
    this.settings = readJSON(this.settingsFile, defaultSettings);
    this.flows = readJSON(this.flowsFile, defaultFlows);
    const existingQr = readJSON(this.quickRepliesFile, defaultQuickReplies);
    if (!existingQr || !Array.isArray(existingQr) || existingQr.length === 0) {
      this.quickReplies = [...defaultQuickReplies];
      writeJSON(this.quickRepliesFile, this.quickReplies);
    } else {
      this.quickReplies = existingQr;
    }
    this.visitors = readJSON(this.visitorsFile, {});
    this.messages = readJSON(this.messagesFile, []);

    // Ensure default credentials: admin / Rizwan@410
    const existingAuth = readJSON(this.authFile, null);
    if (!existingAuth) {
      const initialAuth = {
        username: 'admin',
        passwordHash: hashPassword('Rizwan@410'),
        updatedAt: new Date().toISOString()
      };
      writeJSON(this.authFile, initialAuth);
    }
  }

  // --- Auth & Credentials ---
  getAuth() {
    const auth = readJSON(this.authFile, null);
    if (!auth) {
      const initialAuth = {
        username: 'admin',
        passwordHash: hashPassword('Rizwan@410'),
        updatedAt: new Date().toISOString()
      };
      writeJSON(this.authFile, initialAuth);
      return initialAuth;
    }
    return auth;
  }

  verifyCredentials(username, password) {
    const auth = this.getAuth();
    if (!auth || !auth.username) return false;
    if (auth.username.toLowerCase() !== (username || '').toLowerCase().trim()) return false;
    return verifyPassword(password, auth.passwordHash);
  }

  updateCredentials(newUsername, newPassword) {
    const current = this.getAuth();
    const updated = {
      username: newUsername ? newUsername.trim() : (current.username || 'admin'),
      passwordHash: newPassword ? hashPassword(newPassword) : current.passwordHash,
      updatedAt: new Date().toISOString()
    };
    writeJSON(this.authFile, updated);
    return { success: true, username: updated.username };
  }

  // --- Settings ---
  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    writeJSON(this.settingsFile, this.settings);
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
    writeJSON(this.flowsFile, this.flows);
    return flowData;
  }

  deleteFlow(id) {
    this.flows = this.flows.filter(f => f.id !== id);
    writeJSON(this.flowsFile, this.flows);
    return true;
  }

  // --- Quick Replies ---
  getQuickReplies() {
    return [...this.quickReplies].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getQuickReplyById(id) {
    return this.quickReplies.find(qr => qr.id === id) || null;
  }

  saveQuickReplies(replies) {
    this.quickReplies = replies;
    writeJSON(this.quickRepliesFile, this.quickReplies);
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
    writeJSON(this.visitorsFile, this.visitors);
    return this.visitors[visitorData.id];
  }

  updateVisitorPhone(visitorId, phone) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].phone = phone;
      this.visitors[visitorId].lastActive = new Date().toISOString();
      writeJSON(this.visitorsFile, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  updateVisitorProfile(visitorId, profileData) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId] = {
        ...this.visitors[visitorId],
        ...profileData,
        lastActive: new Date().toISOString()
      };
      writeJSON(this.visitorsFile, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  setBotPaused(visitorId, paused) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].botPaused = paused;
      writeJSON(this.visitorsFile, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  resetUnread(visitorId) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].unreadCount = 0;
      writeJSON(this.visitorsFile, this.visitors);
      return this.visitors[visitorId];
    }
    return null;
  }

  incrementUnread(visitorId) {
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].unreadCount = (this.visitors[visitorId].unreadCount || 0) + 1;
      writeJSON(this.visitorsFile, this.visitors);
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
      sender: msg.sender,
      type: msg.type || 'text',
      content: msg.content || '',
      caption: msg.caption || '',
      voiceDuration: msg.voiceDuration || 0,
      isForwarded: !!msg.isForwarded,
      timestamp: msg.timestamp || new Date().toISOString(),
      status: msg.status || 'delivered'
    };
    this.messages.push(newMsg);
    
    // Update visitor snippet
    if (this.visitors[msg.visitorId]) {
      this.visitors[msg.visitorId].lastMessage = newMsg.content 
        ? (newMsg.type === 'voice' ? '🎤 Voice note' : (newMsg.type === 'image' ? '📷 Photo' : (newMsg.type === 'video' ? '🎥 Video' : newMsg.content)))
        : 'Attachment';
      this.visitors[msg.visitorId].lastActive = newMsg.timestamp;
      writeJSON(this.visitorsFile, this.visitors);
    }

    writeJSON(this.messagesFile, this.messages);
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
      writeJSON(this.messagesFile, this.messages);
    }
    return true;
  }

  clearConversation(visitorId) {
    this.messages = this.messages.filter(m => m.visitorId !== visitorId);
    writeJSON(this.messagesFile, this.messages);
    if (this.visitors[visitorId]) {
      this.visitors[visitorId].lastMessage = '';
      this.visitors[visitorId].unreadCount = 0;
      writeJSON(this.visitorsFile, this.visitors);
    }
    return true;
  }

  deleteVisitor(visitorId) {
    if (this.visitors[visitorId]) {
      delete this.visitors[visitorId];
      writeJSON(this.visitorsFile, this.visitors);
    }
    this.messages = this.messages.filter(m => m.visitorId !== visitorId);
    writeJSON(this.messagesFile, this.messages);
    return true;
  }
}

// Master Multi-Tenant Manager
class StorageManager {
  constructor() {
    this.defaultStorage = new Storage(DATA_DIR, 'default');
    this.tenantCache = new Map();
    this.tenantCache.set('default', this.defaultStorage);
  }

  // Get or initialize tenant storage
  getTenant(tenantId = 'default') {
    const cleanId = (tenantId || 'default').toLowerCase().trim();
    if (cleanId === 'default' || !cleanId) {
      return this.defaultStorage;
    }

    if (this.tenantCache.has(cleanId)) {
      return this.tenantCache.get(cleanId);
    }

    const tenantDirPath = path.join(TENANTS_DIR, cleanId);
    const tenantStorage = new Storage(tenantDirPath, cleanId);
    this.tenantCache.set(cleanId, tenantStorage);

    // Auto-register in tenants.json if not present
    this.ensureTenantRegistered(cleanId);

    return tenantStorage;
  }

  // Registry of tenants
  getTenantsList() {
    return readJSON(TENANTS_FILE, []);
  }

  ensureTenantRegistered(tenantId, name = '') {
    const list = this.getTenantsList();
    if (!list.find(t => t.id === tenantId)) {
      list.push({
        id: tenantId,
        subdomain: tenantId,
        name: name || `Client: ${tenantId}`,
        createdAt: new Date().toISOString(),
        active: true
      });
      writeJSON(TENANTS_FILE, list);
    }
  }

  createTenant({ id, name, username, password }) {
    const cleanId = (id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
    if (!cleanId) throw new Error('Invalid subdomain identifier');

    const list = this.getTenantsList();
    if (list.find(t => t.id === cleanId)) {
      throw new Error(`Subdomain "${cleanId}" already exists!`);
    }

    const tenantDir = path.join(TENANTS_DIR, cleanId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const tenantStorage = new Storage(tenantDir, cleanId);
    
    // Customize tenant brand settings
    tenantStorage.updateSettings({
      brandName: name || cleanId,
      brandSubtitle: `${name || cleanId} Official WhatsApp`
    });

    // Set custom tenant admin credentials
    tenantStorage.updateCredentials(username || 'admin', password || 'Rizwan@410');

    this.tenantCache.set(cleanId, tenantStorage);

    const newRecord = {
      id: cleanId,
      subdomain: cleanId,
      name: name || cleanId,
      createdAt: new Date().toISOString(),
      active: true
    };
    list.push(newRecord);
    writeJSON(TENANTS_FILE, list);

    return newRecord;
  }

  deleteTenant(id) {
    const cleanId = (id || '').toLowerCase().trim();
    if (cleanId === 'default') throw new Error('Cannot delete default master tenant');

    let list = this.getTenantsList();
    list = list.filter(t => t.id !== cleanId);
    writeJSON(TENANTS_FILE, list);

    this.tenantCache.delete(cleanId);

    const tenantDir = path.join(TENANTS_DIR, cleanId);
    if (fs.existsSync(tenantDir)) {
      try {
        fs.rmSync(tenantDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Error removing tenant dir:', e);
      }
    }
    return true;
  }

  // Global Session Manager
  createSession(tenantId, username) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days session
    activeSessions.set(token, {
      tenantId: (tenantId || 'default').toLowerCase(),
      username: username || 'admin',
      expiresAt
    });
    return token;
  }

  verifySession(token) {
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return null;
    }
    return session;
  }

  destroySession(token) {
    if (token) activeSessions.delete(token);
    return true;
  }

  // --- Delegate default tenant operations for backwards compatibility ---
  getSettings() { return this.defaultStorage.getSettings(); }
  updateSettings(s) { return this.defaultStorage.updateSettings(s); }
  getFlows() { return this.defaultStorage.getFlows(); }
  getFlowById(id) { return this.defaultStorage.getFlowById(id); }
  saveFlow(f) { return this.defaultStorage.saveFlow(f); }
  deleteFlow(id) { return this.defaultStorage.deleteFlow(id); }
  getQuickReplies() { return this.defaultStorage.getQuickReplies(); }
  getQuickReplyById(id) { return this.defaultStorage.getQuickReplyById(id); }
  saveQuickReplies(q) { return this.defaultStorage.saveQuickReplies(q); }
  getVisitors() { return this.defaultStorage.getVisitors(); }
  getVisitor(id) { return this.defaultStorage.getVisitor(id); }
  saveVisitor(v) { return this.defaultStorage.saveVisitor(v); }
  updateVisitorPhone(id, p) { return this.defaultStorage.updateVisitorPhone(id, p); }
  updateVisitorProfile(id, p) { return this.defaultStorage.updateVisitorProfile(id, p); }
  setBotPaused(id, p) { return this.defaultStorage.setBotPaused(id, p); }
  resetUnread(id) { return this.defaultStorage.resetUnread(id); }
  incrementUnread(id) { return this.defaultStorage.incrementUnread(id); }
  getMessages(id) { return this.defaultStorage.getMessages(id); }
  addMessage(m) { return this.defaultStorage.addMessage(m); }
  markMessagesRead(id, s) { return this.defaultStorage.markMessagesRead(id, s); }
  clearConversation(id) { return this.defaultStorage.clearConversation(id); }
  deleteVisitor(id) { return this.defaultStorage.deleteVisitor(id); }
  verifyCredentials(u, p) { return this.defaultStorage.verifyCredentials(u, p); }
  updateCredentials(u, p) { return this.defaultStorage.updateCredentials(u, p); }
  getAuth() { return this.defaultStorage.getAuth(); }
}

const masterStorage = new StorageManager();
module.exports = masterStorage;
