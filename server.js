const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');
const storage = require('./storage');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('audio') ? '.webm' : '.png');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'file-' + unique + ext);
  }
});

const upload = multer({
  storage: storageConfig,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Cookie parsing helper
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = (name || '').trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Subdomain / Tenant extraction helper
function getTenantId(req) {
  // 1. Explicit query parameter (ideal for testing locally or before wildcard DNS)
  if (req.query && req.query.tenant) {
    return req.query.tenant.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim() || 'default';
  }
  // 2. Custom header
  if (req.headers && req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'].toLowerCase().replace(/[^a-z0-9_-]/g, '').trim() || 'default';
  }
  // 3. Subdomain from Host header (e.g. client1.joyup.shop -> client1)
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
      return sub.replace(/[^a-z0-9_-]/g, '') || 'default';
    }
  }
  return 'default';
}

function getTenantFromHost(hostStr) {
  if (!hostStr) return 'default';
  const host = hostStr.split(':')[0].toLowerCase();
  const parts = host.split('.');
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'api' && parts[0] !== 'app') {
    return parts[0].replace(/[^a-z0-9_-]/g, '') || 'default';
  }
  return 'default';
}

// Authentication Middleware for Admin Protection
function requireAdminAuth(req, res, next) {
  const cookies = parseCookies(req);
  const authHeader = req.headers['authorization'];
  let token = cookies['wa_admin_token'];
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  const session = storage.verifySession(token);
  if (!session) {
    // If request accepts HTML (like visiting /admin in browser): redirect to /login
    if (req.accepts('html') && !req.path.startsWith('/api/')) {
      const tenant = getTenantId(req);
      const redirectQuery = (tenant && tenant !== 'default') ? `?tenant=${encodeURIComponent(tenant)}` : '';
      return res.redirect('/login' + redirectQuery);
    }
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  req.adminSession = session;
  // If request specifies tenant, ensure matches or superadmin on default
  req.tenantId = session.tenantId || getTenantId(req);
  next();
}

// Express Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Track active timers for flow execution per tenant & visitor
// `${tenantId}_${visitorId}` -> { timeoutId, flowId, stepIndex }
const activeFlowTimers = new Map();

function cancelVisitorFlow(tenantId, visitorId) {
  const timerKey = `${tenantId}_${visitorId}`;
  if (activeFlowTimers.has(timerKey)) {
    const current = activeFlowTimers.get(timerKey);
    if (current.timeoutId) clearTimeout(current.timeoutId);
    activeFlowTimers.delete(timerKey);
    io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', { isTyping: false });
    io.to(`admin_room_${tenantId}`).emit('visitor:typing', { visitorId, isTyping: false });
  }
}

function executeFlowStep(tenantId, visitorId, flow, stepIndex = 0) {
  const tenantStorage = storage.getTenant(tenantId);
  const visitor = tenantStorage.getVisitor(visitorId);
  const settings = tenantStorage.getSettings();

  if (!visitor || !settings.botActive || visitor.botPaused) {
    cancelVisitorFlow(tenantId, visitorId);
    return;
  }

  if (!flow || !flow.steps || stepIndex >= flow.steps.length) {
    cancelVisitorFlow(tenantId, visitorId);
    return;
  }

  const step = flow.steps[stepIndex];
  const delaySec = Math.max(1, parseInt(step.delay) || 2);
  const typingStatus = step.type === 'voice' ? 'recording audio...' : 'typing...';

  io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', { 
    isTyping: true, 
    statusText: typingStatus,
    type: step.type 
  });
  io.to(`admin_room_${tenantId}`).emit('visitor:typing', { 
    visitorId, 
    isTyping: true, 
    statusText: typingStatus,
    fromBot: true 
  });

  const timerKey = `${tenantId}_${visitorId}`;
  const timeoutId = setTimeout(() => {
    const currentVis = tenantStorage.getVisitor(visitorId);
    if (!currentVis || currentVis.botPaused) {
      cancelVisitorFlow(tenantId, visitorId);
      return;
    }

    io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', { isTyping: false });
    io.to(`admin_room_${tenantId}`).emit('visitor:typing', { visitorId, isTyping: false, fromBot: true });

    const newMsg = tenantStorage.addMessage({
      visitorId,
      sender: 'bot',
      type: step.type || 'text',
      content: step.content || '',
      caption: step.caption || '',
      voiceDuration: step.voiceDuration || (step.type === 'voice' ? 12 : 0),
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    io.to(`visitor_${tenantId}_${visitorId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('message:new', newMsg);

    if (step.quickReplies && step.quickReplies.length > 0) {
      io.to(`visitor_${tenantId}_${visitorId}`).emit('quick_replies:update', step.quickReplies);
    }

    if (stepIndex + 1 < flow.steps.length) {
      executeFlowStep(tenantId, visitorId, flow, stepIndex + 1);
    } else {
      activeFlowTimers.delete(timerKey);
      if (flow.triggerType === 'welcome' && settings.phonePromptEnabled && !currentVis.phone) {
        setTimeout(() => {
          const vis = tenantStorage.getVisitor(visitorId);
          if (vis && !vis.phone) {
            io.to(`visitor_${tenantId}_${visitorId}`).emit('phone:prompt', {
              message: settings.phonePromptMessage
            });
          }
        }, (settings.phonePromptDelay || 8) * 1000);
      }
    }
  }, delaySec * 1000);

  activeFlowTimers.set(timerKey, { timeoutId, flowId: flow.id, stepIndex });
}

function triggerFlow(tenantId, visitorId, flow) {
  cancelVisitorFlow(tenantId, visitorId);
  executeFlowStep(tenantId, visitorId, flow, 0);
}

// ---------------- AUTH & TENANT ROUTES ----------------

// Serve Login Page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Logout endpoint
app.get('/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies['wa_admin_token']) {
    storage.destroySession(cookies['wa_admin_token']);
  }
  res.setHeader('Set-Cookie', 'wa_admin_token=; Path=/; HttpOnly; Max-Age=0');
  const tenant = getTenantId(req);
  const redirectQuery = (tenant && tenant !== 'default') ? `?tenant=${encodeURIComponent(tenant)}` : '';
  res.redirect('/login' + redirectQuery);
});

// Login API
app.post('/api/auth/login', (req, res) => {
  const { username, password, tenant } = req.body;
  const tenantId = (tenant || getTenantId(req) || 'default').toLowerCase().trim();
  const tenantStorage = storage.getTenant(tenantId);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const isValid = tenantStorage.verifyCredentials(username, password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = storage.createSession(tenantId, username);
  // Set 30-day session cookie
  res.setHeader('Set-Cookie', `wa_admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

  res.json({
    success: true,
    token,
    tenantId,
    username
  });
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['wa_admin_token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (token) {
    storage.destroySession(token);
  }
  res.setHeader('Set-Cookie', 'wa_admin_token=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
});

// Check Current Session API
app.get('/api/auth/me', requireAdminAuth, (req, res) => {
  res.json({
    authenticated: true,
    username: req.adminSession.username,
    tenantId: req.tenantId
  });
});

// Change Admin Credentials API
app.post('/api/auth/change-credentials', requireAdminAuth, (req, res) => {
  const { newUsername, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }
  const tenantStorage = storage.getTenant(req.tenantId);
  const result = tenantStorage.updateCredentials(newUsername, newPassword);
  res.json(result);
});

// Superadmin Subdomains & Tenants API
app.get('/api/tenants', requireAdminAuth, (req, res) => {
  res.json(storage.getTenantsList());
});

app.post('/api/tenants', requireAdminAuth, (req, res) => {
  try {
    const { id, name, username, password, adminUsername, adminPassword } = req.body;
    const finalUser = username || adminUsername || 'admin';
    const finalPass = password || adminPassword || 'Rizwan@410';
    const newTenant = storage.createTenant({ 
      id, 
      name, 
      username: finalUser, 
      password: finalPass 
    });
    res.json({ success: true, tenant: newTenant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/tenants/:id', requireAdminAuth, (req, res) => {
  try {
    storage.deleteTenant(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- PROTECTED ADMIN REST APIS ----------------

// Settings
app.get('/api/settings', (req, res) => {
  const tenantId = req.tenantId || getTenantId(req);
  res.json(storage.getTenant(tenantId).getSettings());
});

app.post('/api/settings', requireAdminAuth, (req, res) => {
  const tenantStorage = storage.getTenant(req.tenantId);
  const updated = tenantStorage.updateSettings(req.body);
  io.to(`admin_room_${req.tenantId}`).emit('settings:updated', updated);
  res.json(updated);
});

// Flows
app.get('/api/flows', requireAdminAuth, (req, res) => {
  res.json(storage.getTenant(req.tenantId).getFlows());
});

app.post('/api/flows', requireAdminAuth, (req, res) => {
  const tenantStorage = storage.getTenant(req.tenantId);
  const flow = req.body;
  if (!flow.id) {
    flow.id = 'flow_' + Date.now();
  }
  const saved = tenantStorage.saveFlow(flow);
  res.json(saved);
});

app.delete('/api/flows/:id', requireAdminAuth, (req, res) => {
  storage.getTenant(req.tenantId).deleteFlow(req.params.id);
  res.json({ success: true });
});

// Quick Replies
app.get('/api/quick-replies', (req, res) => {
  const tenantId = req.tenantId || getTenantId(req);
  res.json(storage.getTenant(tenantId).getQuickReplies());
});

app.post('/api/quick-replies', requireAdminAuth, (req, res) => {
  const tenantStorage = storage.getTenant(req.tenantId);
  const saved = tenantStorage.saveQuickReplies(req.body);
  io.to(`admin_room_${req.tenantId}`).emit('quick_replies:updated', saved);
  res.json(saved);
});

// Visitors
app.get('/api/visitors', requireAdminAuth, (req, res) => {
  res.json(storage.getTenant(req.tenantId).getVisitors());
});

app.get('/api/visitors/:id/messages', requireAdminAuth, (req, res) => {
  const tenantStorage = storage.getTenant(req.tenantId);
  const messages = tenantStorage.getMessages(req.params.id);
  tenantStorage.resetUnread(req.params.id);
  res.json(messages);
});

app.post('/api/visitors/:id/phone', (req, res) => {
  const tenantId = req.tenantId || getTenantId(req);
  const tenantStorage = storage.getTenant(tenantId);
  const { phone } = req.body;
  const visitor = tenantStorage.updateVisitorPhone(req.params.id, phone);
  if (visitor) {
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
  }
  res.json({ success: true, visitor });
});

app.post('/api/visitors/:id/profile', (req, res) => {
  const tenantId = req.tenantId || getTenantId(req);
  const tenantStorage = storage.getTenant(tenantId);
  const { name, phone, avatar } = req.body;
  const visitor = tenantStorage.updateVisitorProfile(req.params.id, { name, phone, avatar });
  if (visitor) {
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
    return res.json({ success: true, visitor });
  }
  res.status(404).json({ error: 'Visitor not found' });
});

app.post('/api/visitors/:id/clear', requireAdminAuth, (req, res) => {
  const tenantId = req.tenantId;
  const tenantStorage = storage.getTenant(tenantId);
  cancelVisitorFlow(tenantId, req.params.id);
  tenantStorage.clearConversation(req.params.id);
  io.to(`visitor_${tenantId}_${req.params.id}`).emit('conversation:cleared');
  io.to(`admin_room_${tenantId}`).emit('visitor:cleared', { visitorId: req.params.id });
  res.json({ success: true });
});

app.delete('/api/visitors/:id', requireAdminAuth, (req, res) => {
  const tenantId = req.tenantId;
  const tenantStorage = storage.getTenant(tenantId);
  cancelVisitorFlow(tenantId, req.params.id);
  tenantStorage.deleteVisitor(req.params.id);
  io.to(`admin_room_${tenantId}`).emit('visitor:deleted', { visitorId: req.params.id });
  res.json({ success: true });
});

app.post('/api/visitors/:id/toggle-bot', requireAdminAuth, (req, res) => {
  const tenantId = req.tenantId;
  const tenantStorage = storage.getTenant(tenantId);
  const { botPaused } = req.body;
  const visitor = tenantStorage.setBotPaused(req.params.id, botPaused);
  if (botPaused) {
    cancelVisitorFlow(tenantId, req.params.id);
  }
  io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
  res.json({ success: true, visitor });
});

// File Upload endpoint (Images, Videos, Voice notes, Avatars)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Export Leads to CSV
app.get('/api/export-leads', requireAdminAuth, (req, res) => {
  const tenantStorage = storage.getTenant(req.tenantId);
  const visitors = tenantStorage.getVisitors();
  let csv = 'Visitor ID,Name,Phone / WhatsApp,Created At,Last Active,Source,Status\n';
  for (const v of visitors) {
    csv += `"${v.id}","${(v.name || '').replace(/"/g, '""')}","${(v.phone || '').replace(/"/g, '""')}","${v.createdAt || ''}","${v.lastActive || ''}","${(v.source || '').replace(/"/g, '""')}","${v.phone ? 'Lead Captured' : 'Visitor'}"\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=leads_${Date.now()}.csv`);
  res.send(csv);
});

// ---------------- SOCKET.IO REAL-TIME LOGIC ----------------

io.on('connection', (socket) => {
  // Resolve tenant for this socket connection
  const tenantId = (socket.handshake.query.tenantId || '').toLowerCase() 
    || getTenantFromHost(socket.handshake.headers.host) 
    || 'default';
  
  socket.tenantId = tenantId;
  const tenantStorage = storage.getTenant(tenantId);

  // --- VISITOR HANDLERS ---
  socket.on('visitor:join', ({ visitorId, name, avatar, platform, source, referrer }) => {
    socket.visitorId = visitorId;
    socket.join(`visitor_${tenantId}_${visitorId}`);

    let detectedPlatform = platform || 'web';
    const sLower = (source || '').toLowerCase();
    const rLower = (referrer || '').toLowerCase();

    if (sLower.includes('tiktok') || rLower.includes('tiktok') || sLower.includes('musical_ly')) {
      detectedPlatform = 'tiktok';
    } else if (sLower.includes('facebook') || sLower.includes('fb') || sLower.includes('instagram') || rLower.includes('facebook') || rLower.includes('instagram')) {
      detectedPlatform = 'facebook';
    }

    let defaultAvatar = '/assets/default-avatar.svg';
    if (detectedPlatform === 'tiktok') defaultAvatar = '/assets/tiktok-avatar.svg';
    else if (detectedPlatform === 'facebook') defaultAvatar = '/assets/facebook-avatar.svg';

    const shortId = visitorId ? visitorId.slice(-4) : Math.floor(1000 + Math.random() * 9000);
    let defaultName = `Visitor #${shortId}`;
    if (detectedPlatform === 'tiktok') defaultName = `TikTok User #${shortId}`;
    else if (detectedPlatform === 'facebook') defaultName = `Facebook User #${shortId}`;

    let visitor = tenantStorage.getVisitor(visitorId);
    let isNewVisitor = false;

    if (!visitor) {
      isNewVisitor = true;
      visitor = tenantStorage.saveVisitor({
        id: visitorId,
        name: name || defaultName,
        avatar: avatar || defaultAvatar,
        platform: detectedPlatform,
        phone: '',
        createdAt: new Date().toISOString(),
        isOnline: true,
        botPaused: false,
        unreadCount: 0,
        source: source || (referrer ? new URL(referrer).hostname : (detectedPlatform === 'tiktok' ? 'TikTok Ads' : (detectedPlatform === 'facebook' ? 'Facebook Ads' : 'Direct Traffic')))
      });
    } else {
      visitor = tenantStorage.saveVisitor({
        ...visitor,
        name: (name && name !== defaultName) ? name : (visitor.name || defaultName),
        avatar: (avatar && avatar !== defaultAvatar) ? avatar : (visitor.avatar || defaultAvatar),
        platform: visitor.platform || detectedPlatform,
        isOnline: true
      });
    }

    const messages = tenantStorage.getMessages(visitorId);
    const settings = tenantStorage.getSettings();
    const quickReplies = tenantStorage.getQuickReplies();

    socket.emit('visitor:init_data', {
      visitor,
      messages,
      settings,
      quickReplies
    });

    io.to(`admin_room_${tenantId}`).emit('visitor:status', { visitorId, isOnline: true });
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);

    if (isNewVisitor || messages.length === 0) {
      if (settings.botActive && settings.autoWelcome) {
        const welcomeFlow = tenantStorage.flows.find(f => f.triggerType === 'welcome' && f.enabled);
        if (welcomeFlow) {
          setTimeout(() => {
            triggerFlow(tenantId, visitorId, welcomeFlow);
          }, (settings.welcomeDelay || 2) * 1000);
        }
      }
    }
  });

  socket.on('visitor:message', (data) => {
    const { visitorId, text, type, content, caption, voiceDuration } = data;
    if (!visitorId) return;

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,13}\b/;
    const phoneMatch = text ? text.match(phoneRegex) : null;
    if (phoneMatch) {
      tenantStorage.updateVisitorPhone(visitorId, phoneMatch[0].trim());
    }

    let visitor = tenantStorage.getVisitor(visitorId);
    if (!visitor) {
      visitor = tenantStorage.saveVisitor({
        id: visitorId,
        name: `Visitor #${visitorId.slice(-4)}`,
        phone: phoneMatch ? phoneMatch[0].trim() : '',
        createdAt: new Date().toISOString(),
        isOnline: true,
        botPaused: false,
        unreadCount: 1,
        source: 'Direct / Ads'
      });
    } else {
      tenantStorage.incrementUnread(visitorId);
    }

    const newMsg = tenantStorage.addMessage({
      visitorId,
      sender: 'visitor',
      type: type || 'text',
      content: text || content || '',
      caption: caption || '',
      voiceDuration: voiceDuration || 0,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    const updatedVisitor = tenantStorage.getVisitor(visitorId);

    socket.emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', updatedVisitor);

    const settings = tenantStorage.getSettings();
    if (settings.botActive && !updatedVisitor.botPaused) {
      const cleanInput = (text || '').toLowerCase().trim();
      let matchedFlow = null;

      if (cleanInput) {
        matchedFlow = tenantStorage.flows.find(f => {
          if (!f.enabled) return false;
          return (f.keywords || []).some(kw => {
            const cleanKw = kw.toLowerCase().trim();
            return cleanKw && cleanInput.includes(cleanKw);
          });
        });
      }

      if (matchedFlow) {
        triggerFlow(tenantId, visitorId, matchedFlow);
      } else if (settings.fallbackMessage) {
        setTimeout(() => {
          const currentVis = tenantStorage.getVisitor(visitorId);
          if (currentVis && !currentVis.botPaused && !activeFlowTimers.has(`${tenantId}_${visitorId}`)) {
            io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', { isTyping: true, statusText: 'typing...' });
            setTimeout(() => {
              io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', { isTyping: false });
              const fallbackMsg = tenantStorage.addMessage({
                visitorId,
                sender: 'bot',
                type: 'text',
                content: settings.fallbackMessage,
                timestamp: new Date().toISOString()
              });
              io.to(`visitor_${tenantId}_${visitorId}`).emit('message:new', fallbackMsg);
              io.to(`admin_room_${tenantId}`).emit('message:new', fallbackMsg);
            }, 2000);
          }
        }, 1500);
      }
    }
  });

  socket.on('visitor:typing', ({ visitorId, isTyping }) => {
    io.to(`admin_room_${tenantId}`).emit('visitor:typing', { visitorId, isTyping, fromBot: false });
  });

  socket.on('visitor:save_phone', ({ visitorId, phone }) => {
    if (!visitorId || !phone) return;
    let visitor = tenantStorage.getVisitor(visitorId);
    if (!visitor) {
      visitor = tenantStorage.saveVisitor({
        id: visitorId,
        name: `Visitor #${visitorId.slice(-4)}`,
        phone,
        createdAt: new Date().toISOString(),
        isOnline: true,
        botPaused: false,
        unreadCount: 0,
        source: 'Direct / Ads'
      });
    } else {
      visitor = tenantStorage.updateVisitorPhone(visitorId, phone);
    }
    
    const botMsg = tenantStorage.addMessage({
      visitorId,
      sender: 'bot',
      type: 'text',
      content: `✅ Thank you! We received your number (${phone}). Our team will reach out promptly.`,
      timestamp: new Date().toISOString()
    });

    io.to(`visitor_${tenantId}_${visitorId}`).emit('message:new', botMsg);
    io.to(`admin_room_${tenantId}`).emit('message:new', botMsg);
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
  });

  // --- ADMIN HANDLERS ---
  socket.on('admin:join', (authData) => {
    // Check auth token
    const token = (authData && authData.token) || socket.handshake.auth.token;
    const session = storage.verifySession(token);
    if (!session) {
      return socket.emit('auth:required');
    }

    socket.join(`admin_room_${tenantId}`);
    socket.emit('admin:init_data', {
      tenantId: tenantId,
      username: session.username,
      visitors: tenantStorage.getVisitors(),
      flows: tenantStorage.getFlows(),
      settings: tenantStorage.getSettings(),
      quickReplies: tenantStorage.getQuickReplies()
    });
  });

  socket.on('admin:select_visitor', ({ visitorId }) => {
    tenantStorage.resetUnread(visitorId);
    tenantStorage.markMessagesRead(visitorId, 'visitor');
    const visitor = tenantStorage.getVisitor(visitorId);
    if (visitor) {
      io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
    }
    io.to(`visitor_${tenantId}_${visitorId}`).emit('messages:read');
  });

  socket.on('admin:send_message', (data) => {
    const { visitorId, type, content, caption, voiceDuration } = data;
    if (!visitorId) return;

    cancelVisitorFlow(tenantId, visitorId);
    tenantStorage.setBotPaused(visitorId, true);

    const newMsg = tenantStorage.addMessage({
      visitorId,
      sender: 'admin',
      type: type || 'text',
      content: content || '',
      caption: caption || '',
      voiceDuration: voiceDuration || 0,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    const visitor = tenantStorage.getVisitor(visitorId);

    io.to(`visitor_${tenantId}_${visitorId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
  });

  socket.on('admin:typing', ({ visitorId, isTyping }) => {
    io.to(`visitor_${tenantId}_${visitorId}`).emit('typing:status', {
      isTyping,
      statusText: isTyping ? 'typing...' : ''
    });
  });

  socket.on('admin:trigger_flow', ({ visitorId, flowId }) => {
    const flow = tenantStorage.getFlowById(flowId);
    if (flow) {
      tenantStorage.setBotPaused(visitorId, false);
      const visitor = tenantStorage.getVisitor(visitorId);
      io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
      triggerFlow(tenantId, visitorId, flow);
    }
  });

  socket.on('admin:trigger_quick_reply', ({ visitorId, qrId }) => {
    if (!visitorId || !qrId) return;
    const qr = tenantStorage.getQuickReplyById(qrId);
    if (!qr) return;

    const actionType = qr.actionType || (qr.flowId ? 'flow' : (qr.type || 'text'));
    if (actionType === 'flow' && qr.flowId) {
      const flow = tenantStorage.getFlowById(qr.flowId);
      if (flow) {
        tenantStorage.setBotPaused(visitorId, false);
        const visitor = tenantStorage.getVisitor(visitorId);
        io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
        triggerFlow(tenantId, visitorId, flow);
      }
    } else {
      cancelVisitorFlow(tenantId, visitorId);
      tenantStorage.setBotPaused(visitorId, true);
      const newMsg = tenantStorage.addMessage({
        visitorId,
        sender: 'admin',
        type: actionType,
        content: qr.content || '',
        caption: qr.caption || '',
        voiceDuration: qr.voiceDuration || (actionType === 'voice' ? 10 : 0),
        timestamp: new Date().toISOString(),
        status: 'delivered'
      });
      const visitor = tenantStorage.getVisitor(visitorId);
      io.to(`visitor_${tenantId}_${visitorId}`).emit('message:new', newMsg);
      io.to(`admin_room_${tenantId}`).emit('message:new', newMsg);
      io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
    }
  });

  socket.on('admin:forward_message', ({ targetVisitorId, originalMessageId, type, content, caption, voiceDuration }) => {
    if (!targetVisitorId) return;
    const originalMsg = originalMessageId ? tenantStorage.messages.find(m => m.id === originalMessageId) : null;

    const newMsg = tenantStorage.addMessage({
      visitorId: targetVisitorId,
      sender: 'admin',
      type: originalMsg ? originalMsg.type : (type || 'text'),
      content: originalMsg ? originalMsg.content : (content || ''),
      caption: originalMsg ? originalMsg.caption : (caption || ''),
      voiceDuration: originalMsg ? originalMsg.voiceDuration : (voiceDuration || 0),
      isForwarded: true,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    const targetVis = tenantStorage.getVisitor(targetVisitorId);
    io.to(`visitor_${tenantId}_${targetVisitorId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('message:new', newMsg);
    io.to(`admin_room_${tenantId}`).emit('visitor:updated', targetVis);
  });

  socket.on('disconnect', () => {
    if (socket.visitorId) {
      const visitor = tenantStorage.getVisitor(socket.visitorId);
      if (visitor) {
        visitor.isOnline = false;
        tenantStorage.saveVisitor(visitor);
        io.to(`admin_room_${tenantId}`).emit('visitor:status', { visitorId: socket.visitorId, isOnline: false });
        io.to(`admin_room_${tenantId}`).emit('visitor:updated', visitor);
      }
    }
  });
});

// Visitor Landing Page for root and tenant path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protected Admin dashboard route (redirects to /login if not authenticated)
app.get('/admin', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 WHATSAPP LIVE CHAT & SALES FUNNEL MULTI-TENANT SYSTEM`);
  console.log(`💬 Visitor Landing Page : http://localhost:${PORT}`);
  console.log(`🛠️ Admin Dashboard       : http://localhost:${PORT}/admin`);
  console.log(`🔐 Admin Login           : http://localhost:${PORT}/login`);
  console.log(`📁 Uploads Directory     : ${UPLOADS_DIR}`);
  console.log(`======================================================\n`);
});
