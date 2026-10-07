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

// Ensure uploads dir
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
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Track active timers for flow execution per visitor
// visitorId -> { timeoutId, typingTimeoutId, flowId, stepIndex }
const activeFlowTimers = new Map();

// Helper to cancel any ongoing flow for a visitor
function cancelVisitorFlow(visitorId) {
  if (activeFlowTimers.has(visitorId)) {
    const current = activeFlowTimers.get(visitorId);
    if (current.timeoutId) clearTimeout(current.timeoutId);
    if (current.typingTimeoutId) clearTimeout(current.typingTimeoutId);
    activeFlowTimers.delete(visitorId);
    // Tell client typing has stopped
    io.to(`visitor_${visitorId}`).emit('typing:status', { isTyping: false });
    io.to('admin_room').emit('visitor:typing', { visitorId, isTyping: false });
  }
}

// Execute a step of a flow
function executeFlowStep(visitorId, flow, stepIndex = 0) {
  // Check if visitor exists and bot is active and not paused
  const visitor = storage.getVisitor(visitorId);
  const settings = storage.getSettings();

  if (!visitor || !settings.botActive || visitor.botPaused) {
    cancelVisitorFlow(visitorId);
    return;
  }

  if (!flow || !flow.steps || stepIndex >= flow.steps.length) {
    cancelVisitorFlow(visitorId);
    return;
  }

  const step = flow.steps[stepIndex];
  const delaySec = Math.max(1, parseInt(step.delay) || 2);
  const typingStatus = step.type === 'voice' ? 'recording audio...' : 'typing...';

  // Immediately notify visitor & admin of typing / recording status
  io.to(`visitor_${visitorId}`).emit('typing:status', { 
    isTyping: true, 
    statusText: typingStatus,
    type: step.type 
  });
  io.to('admin_room').emit('visitor:typing', { 
    visitorId, 
    isTyping: true, 
    statusText: typingStatus,
    fromBot: true 
  });

  // Schedule the message release after the configured delay
  const timeoutId = setTimeout(() => {
    // Check again if visitor was paused during timer
    const currentVis = storage.getVisitor(visitorId);
    if (!currentVis || currentVis.botPaused) {
      cancelVisitorFlow(visitorId);
      return;
    }

    // Stop typing
    io.to(`visitor_${visitorId}`).emit('typing:status', { isTyping: false });
    io.to('admin_room').emit('visitor:typing', { visitorId, isTyping: false, fromBot: true });

    // Create and save message
    const newMsg = storage.addMessage({
      visitorId,
      sender: 'bot',
      type: step.type || 'text',
      content: step.content || '',
      caption: step.caption || '',
      voiceDuration: step.voiceDuration || (step.type === 'voice' ? 12 : 0),
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    // Broadcast message to visitor and admin
    io.to(`visitor_${visitorId}`).emit('message:new', newMsg);
    io.to('admin_room').emit('message:new', newMsg);

    // If step specifies custom quick replies, push them
    if (step.quickReplies && step.quickReplies.length > 0) {
      io.to(`visitor_${visitorId}`).emit('quick_replies:update', step.quickReplies);
    }

    // Move to next step if exists
    if (stepIndex + 1 < flow.steps.length) {
      executeFlowStep(visitorId, flow, stepIndex + 1);
    } else {
      activeFlowTimers.delete(visitorId);

      // Check if phone prompt should be shown after welcome flow finishes
      if (flow.triggerType === 'welcome' && settings.phonePromptEnabled && !currentVis.phone) {
        setTimeout(() => {
          const vis = storage.getVisitor(visitorId);
          if (vis && !vis.phone) {
            io.to(`visitor_${visitorId}`).emit('phone:prompt', {
              message: settings.phonePromptMessage
            });
          }
        }, (settings.phonePromptDelay || 8) * 1000);
      }
    }
  }, delaySec * 1000);

  activeFlowTimers.set(visitorId, { timeoutId, flowId: flow.id, stepIndex });
}

// Trigger a flow for visitor
function triggerFlow(visitorId, flow) {
  if (!flow || !flow.steps || flow.steps.length === 0) return false;
  cancelVisitorFlow(visitorId);
  executeFlowStep(visitorId, flow, 0);
  return true;
}

// ---------------- REST API ----------------

// Get Settings
app.get('/api/settings', (req, res) => {
  res.json(storage.getSettings());
});

// Update Settings
app.post('/api/settings', (req, res) => {
  const updated = storage.updateSettings(req.body);
  io.emit('settings:updated', updated);
  res.json(updated);
});

// Get Flows
app.get('/api/flows', (req, res) => {
  res.json(storage.getFlows());
});

// Save or Update Flow
app.post('/api/flows', (req, res) => {
  const flow = req.body;
  if (!flow.id) {
    flow.id = 'flow_' + Date.now();
  }
  const saved = storage.saveFlow(flow);
  res.json(saved);
});

// Delete Flow
app.delete('/api/flows/:id', (req, res) => {
  storage.deleteFlow(req.params.id);
  res.json({ success: true });
});

// Get Quick Replies
app.get('/api/quick-replies', (req, res) => {
  res.json(storage.getQuickReplies());
});

// Save Quick Replies
app.post('/api/quick-replies', (req, res) => {
  const replies = req.body;
  const saved = storage.saveQuickReplies(replies);
  io.emit('quick_replies:updated', saved);
  res.json(saved);
});

// Get Visitors List
app.get('/api/visitors', (req, res) => {
  res.json(storage.getVisitors());
});

// Get Visitor Messages
app.get('/api/visitors/:id/messages', (req, res) => {
  const messages = storage.getMessages(req.params.id);
  storage.resetUnread(req.params.id);
  res.json(messages);
});

// Update Visitor Phone / Lead
app.post('/api/visitors/:id/phone', (req, res) => {
  const { phone } = req.body;
  const visitor = storage.updateVisitorPhone(req.params.id, phone);
  if (visitor) {
    io.to('admin_room').emit('visitor:updated', visitor);
  }
  res.json({ success: true, visitor });
});

// Clear Visitor Conversation
app.post('/api/visitors/:id/clear', (req, res) => {
  cancelVisitorFlow(req.params.id);
  storage.clearConversation(req.params.id);
  io.to(`visitor_${req.params.id}`).emit('conversation:cleared');
  io.to('admin_room').emit('visitor:cleared', { visitorId: req.params.id });
  res.json({ success: true });
});

// Toggle Bot for Visitor
app.post('/api/visitors/:id/toggle-bot', (req, res) => {
  const { botPaused } = req.body;
  const visitor = storage.setBotPaused(req.params.id, botPaused);
  if (botPaused) {
    cancelVisitorFlow(req.params.id);
  }
  io.to('admin_room').emit('visitor:updated', visitor);
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
app.get('/api/export-leads', (req, res) => {
  const visitors = storage.getVisitors();
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

  // --- VISITOR HANDLERS ---
  socket.on('visitor:join', ({ visitorId, name, source, referrer }) => {
    socket.visitorId = visitorId;
    socket.join(`visitor_${visitorId}`);

    let visitor = storage.getVisitor(visitorId);
    let isNewVisitor = false;

    if (!visitor) {
      isNewVisitor = true;
      visitor = storage.saveVisitor({
        id: visitorId,
        name: name || `Visitor #${Math.floor(1000 + Math.random() * 9000)}`,
        phone: '',
        createdAt: new Date().toISOString(),
        isOnline: true,
        botPaused: false,
        unreadCount: 0,
        source: source || (referrer ? new URL(referrer).hostname : 'Direct / Ads')
      });
    } else {
      visitor = storage.saveVisitor({
        ...visitor,
        isOnline: true
      });
    }

    const messages = storage.getMessages(visitorId);
    const settings = storage.getSettings();
    const quickReplies = storage.getQuickReplies();

    // Send initial bundle back to visitor
    socket.emit('visitor:init_data', {
      visitor,
      messages,
      settings,
      quickReplies
    });

    // Notify admin
    io.to('admin_room').emit('visitor:status', { visitorId, isOnline: true });
    io.to('admin_room').emit('visitor:updated', visitor);

    // If new visitor or empty messages and autoWelcome is enabled, fire Welcome Flow
    if (isNewVisitor || messages.length === 0) {
      if (settings.botActive && settings.autoWelcome) {
        const welcomeFlow = storage.flows.find(f => f.triggerType === 'welcome' && f.enabled);
        if (welcomeFlow) {
          setTimeout(() => {
            triggerFlow(visitorId, welcomeFlow);
          }, (settings.welcomeDelay || 2) * 1000);
        }
      }
    }
  });

  socket.on('visitor:message', (data) => {
    const { visitorId, text, type, content, caption, voiceDuration } = data;
    if (!visitorId) return;

    // Check if phone number is detected in text (e.g. +123..., 0300..., etc.)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,13}\b/;
    const phoneMatch = text ? text.match(phoneRegex) : null;
    if (phoneMatch) {
      storage.updateVisitorPhone(visitorId, phoneMatch[0].trim());
    }

    // Ensure visitor exists in storage
    let visitor = storage.getVisitor(visitorId);
    if (!visitor) {
      visitor = storage.saveVisitor({
        id: visitorId,
        name: `Visitor #${visitorId.slice(-4)}`,
        phone: phoneMatch ? phoneMatch[0].trim() : '',
        createdAt: new Date().toISOString(),
        isOnline: true,
        botPaused: false,
        unreadCount: 0,
        source: 'Direct / Ads'
      });
    }

    // Save visitor message
    const newMsg = storage.addMessage({
      visitorId,
      sender: 'visitor',
      type: type || 'text',
      content: content || text || '',
      caption: caption || '',
      voiceDuration: voiceDuration || 0,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    // Increment admin unread count
    storage.incrementUnread(visitorId);
    const updatedVisitor = storage.getVisitor(visitorId);

    // Broadcast to visitor and admin
    io.to(`visitor_${visitorId}`).emit('message:new', newMsg);
    io.to('admin_room').emit('message:new', newMsg);
    if (updatedVisitor) {
      io.to('admin_room').emit('visitor:updated', updatedVisitor);
    }

    // Check bot response logic
    const settings = storage.getSettings();
    if (settings.botActive && updatedVisitor && !updatedVisitor.botPaused) {
      // Find matching flow by keyword or quick reply
      const matchedFlow = storage.findFlowByKeyword(text);
      if (matchedFlow) {
        triggerFlow(visitorId, matchedFlow);
      } else {
        // Fallback response if enabled
        if (settings.fallbackMessage) {
          setTimeout(() => {
            const currentVis = storage.getVisitor(visitorId);
            if (currentVis && !currentVis.botPaused && !activeFlowTimers.has(visitorId)) {
              // Show typing
              io.to(`visitor_${visitorId}`).emit('typing:status', { isTyping: true, statusText: 'typing...' });
              setTimeout(() => {
                io.to(`visitor_${visitorId}`).emit('typing:status', { isTyping: false });
                const fallbackMsg = storage.addMessage({
                  visitorId,
                  sender: 'bot',
                  type: 'text',
                  content: settings.fallbackMessage,
                  timestamp: new Date().toISOString()
                });
                io.to(`visitor_${visitorId}`).emit('message:new', fallbackMsg);
                io.to('admin_room').emit('message:new', fallbackMsg);
              }, 2000);
            }
          }, 1500);
        }
      }
    }
  });

  socket.on('visitor:typing', ({ visitorId, isTyping }) => {
    io.to('admin_room').emit('visitor:typing', { visitorId, isTyping, fromBot: false });
  });

  socket.on('visitor:save_phone', ({ visitorId, phone }) => {
    if (!visitorId || !phone) return;
    let visitor = storage.getVisitor(visitorId);
    if (!visitor) {
      visitor = storage.saveVisitor({
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
      visitor = storage.updateVisitorPhone(visitorId, phone);
    }
    
    // Add a confirmation bot message
    const botMsg = storage.addMessage({
      visitorId,
      sender: 'bot',
      type: 'text',
      content: `✅ Thank you! We received your number (${phone}). Our team will reach out promptly.`,
      timestamp: new Date().toISOString()
    });

    io.to(`visitor_${visitorId}`).emit('message:new', botMsg);
    io.to('admin_room').emit('message:new', botMsg);
    io.to('admin_room').emit('visitor:updated', visitor);
  });

  // --- ADMIN HANDLERS ---
  socket.on('admin:join', () => {
    socket.join('admin_room');
    socket.emit('admin:init_data', {
      visitors: storage.getVisitors(),
      flows: storage.getFlows(),
      settings: storage.getSettings(),
      quickReplies: storage.getQuickReplies()
    });
  });

  socket.on('admin:select_visitor', ({ visitorId }) => {
    storage.resetUnread(visitorId);
    storage.markMessagesRead(visitorId, 'visitor');
    const visitor = storage.getVisitor(visitorId);
    if (visitor) {
      io.to('admin_room').emit('visitor:updated', visitor);
    }
    // Inform visitor their messages were read (turns blue checkmarks!)
    io.to(`visitor_${visitorId}`).emit('messages:read');
  });

  socket.on('admin:send_message', (data) => {
    const { visitorId, type, content, caption, voiceDuration } = data;
    if (!visitorId) return;

    // Admin replies -> automatically cancel any pending bot flow so human takes control!
    cancelVisitorFlow(visitorId);
    // Auto pause bot for this visitor so bot doesn't interrupt human agent
    storage.setBotPaused(visitorId, true);

    const newMsg = storage.addMessage({
      visitorId,
      sender: 'admin',
      type: type || 'text',
      content: content || '',
      caption: caption || '',
      voiceDuration: voiceDuration || 0,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });

    const visitor = storage.getVisitor(visitorId);

    io.to(`visitor_${visitorId}`).emit('message:new', newMsg);
    io.to('admin_room').emit('message:new', newMsg);
    io.to('admin_room').emit('visitor:updated', visitor);
  });

  socket.on('admin:typing', ({ visitorId, isTyping }) => {
    io.to(`visitor_${visitorId}`).emit('typing:status', {
      isTyping,
      statusText: isTyping ? 'typing...' : ''
    });
  });

  socket.on('admin:trigger_flow', ({ visitorId, flowId }) => {
    const flow = storage.getFlowById(flowId);
    if (flow) {
      // Unpause bot for this trigger
      storage.setBotPaused(visitorId, false);
      const visitor = storage.getVisitor(visitorId);
      io.to('admin_room').emit('visitor:updated', visitor);
      triggerFlow(visitorId, flow);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (socket.visitorId) {
      const visitor = storage.getVisitor(socket.visitorId);
      if (visitor) {
        visitor.isOnline = false;
        storage.saveVisitor(visitor);
        io.to('admin_room').emit('visitor:status', { visitorId: socket.visitorId, isOnline: false });
        io.to('admin_room').emit('visitor:updated', visitor);
      }
    }
  });
});

// Fallback to visitor chat for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 WHATSAPP LIVE CHAT & SALES FUNNEL SYSTEM RUNNING`);
  console.log(`💬 Visitor Landing Page : http://localhost:${PORT}`);
  console.log(`🛠️ Admin Dashboard       : http://localhost:${PORT}/admin`);
  console.log(`📁 Uploads Directory     : ${UPLOADS_DIR}`);
  console.log(`======================================================\n`);
});
