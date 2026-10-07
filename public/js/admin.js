/**
 * Admin Control Panel Script
 * Handles real-time inbox, live takeover, voice recorder, funnel builder & CRM
 */

(function () {
  'use strict';

  let socket = null;
  let visitors = [];
  let flows = [];
  let settings = {};
  let quickReplies = [];
  let activeVisitorId = null;
  let currentAudios = new Map();

  // Voice Recording state
  let mediaRecorder = null;
  let audioChunks = [];
  let recordStartTime = null;
  let recordTimerInterval = null;

  // DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const totalUnreadBadge = document.getElementById('totalUnreadBadge');
  const globalBotToggle = document.getElementById('globalBotToggle');
  const visitorSearchInput = document.getElementById('visitorSearchInput');
  const visitorList = document.getElementById('visitorList');

  // Inbox Elements
  const chatPaneHeader = document.getElementById('chatPaneHeader');
  const chatHeaderActions = document.getElementById('chatHeaderActions');
  const activeVisitorAvatar = document.getElementById('activeVisitorAvatar');
  const activeVisitorDot = document.getElementById('activeVisitorDot');
  const activeVisitorName = document.getElementById('activeVisitorName');
  const activeVisitorLeadBadge = document.getElementById('activeVisitorLeadBadge');
  const activeVisitorPhone = document.getElementById('activeVisitorPhone');
  const activeVisitorSource = document.getElementById('activeVisitorSource');
  const toggleVisitorBotBtn = document.getElementById('toggleVisitorBotBtn');
  const quickTriggerFlowSelect = document.getElementById('quickTriggerFlowSelect');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const deleteVisitorBtn = document.getElementById('deleteVisitorBtn');
  const detailDeleteVisitorBtn = document.getElementById('detailDeleteVisitorBtn');
  const adminChatFeed = document.getElementById('adminChatFeed');
  const chatPaneFooter = document.getElementById('chatPaneFooter');
  const adminMessageInput = document.getElementById('adminMessageInput');
  const adminSendBtn = document.getElementById('adminSendBtn');
  const adminAttachBtn = document.getElementById('adminAttachBtn');
  const adminFileInput = document.getElementById('adminFileInput');
  const adminMicBtn = document.getElementById('adminMicBtn');
  const adminVoiceRecordBar = document.getElementById('adminVoiceRecordBar');
  const recordTimer = document.getElementById('recordTimer');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');
  const sendVoiceRecordBtn = document.getElementById('sendVoiceRecordBtn');

  // Details Pane Elements
  const detailVisitorId = document.getElementById('detailVisitorId');
  const detailVisitorNameInput = document.getElementById('detailVisitorNameInput');
  const detailVisitorPhoneInput = document.getElementById('detailVisitorPhoneInput');
  const saveLeadDetailsBtn = document.getElementById('saveLeadDetailsBtn');
  const detailVisitorSource = document.getElementById('detailVisitorSource');
  const detailVisitorCreated = document.getElementById('detailVisitorCreated');
  const detailVisitorActive = document.getElementById('detailVisitorActive');
  const directWhatsAppLink = document.getElementById('directWhatsAppLink');

  // Funnel Flow Builder Elements
  const flowsGrid = document.getElementById('flowsGrid');
  const createNewFlowBtn = document.getElementById('createNewFlowBtn');
  const flowModal = document.getElementById('flowModal');
  const closeFlowModal = document.getElementById('closeFlowModal');
  const cancelFlowModal = document.getElementById('cancelFlowModal');
  const saveFlowModalBtn = document.getElementById('saveFlowModalBtn');
  const flowModalTitle = document.getElementById('flowModalTitle');
  const modalFlowId = document.getElementById('modalFlowId');
  const modalFlowName = document.getElementById('modalFlowName');
  const modalFlowTriggerType = document.getElementById('modalFlowTriggerType');
  const modalFlowKeywords = document.getElementById('modalFlowKeywords');
  const modalStepsList = document.getElementById('modalStepsList');
  const addStepBtn = document.getElementById('addStepBtn');

  // Quick Replies Elements
  const quickRepliesTableBody = document.getElementById('quickRepliesTableBody');
  const addQuickReplyBtn = document.getElementById('addQuickReplyBtn');

  // Settings Elements
  const settingBrandName = document.getElementById('settingBrandName');
  const settingBrandSubtitle = document.getElementById('settingBrandSubtitle');
  const settingAvatarPreview = document.getElementById('settingAvatarPreview');
  const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const settingSoundToggle = document.getElementById('settingSoundToggle');
  const saveBrandSettingsBtn = document.getElementById('saveBrandSettingsBtn');
  const settingPhonePromptToggle = document.getElementById('settingPhonePromptToggle');
  const settingPhonePromptDelay = document.getElementById('settingPhonePromptDelay');
  const settingPhonePromptMessage = document.getElementById('settingPhonePromptMessage');
  const settingFallbackMessage = document.getElementById('settingFallbackMessage');
  const savePromptSettingsBtn = document.getElementById('savePromptSettingsBtn');
  const adminNotifyAudio = document.getElementById('adminNotifyAudio');

  // --- Notification Sound ---
  function playNotificationSound() {
    try {
      if (settings.soundEnabled !== false && adminNotifyAudio) {
        adminNotifyAudio.currentTime = 0;
        adminNotifyAudio.play().catch(() => {});
      }
    } catch (e) {}
  }

  // --- Tab Navigation ---
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // --- Connect Socket.io ---
  function connectAdminSocket() {
    socket = io();

    socket.on('connect', () => {
      socket.emit('admin:join');
    });

    socket.on('admin:init_data', (data) => {
      visitors = data.visitors || [];
      flows = data.flows || [];
      settings = data.settings || {};
      quickReplies = data.quickReplies || [];

      globalBotToggle.checked = !!settings.botActive;
      populateSettingsForm(settings);
      renderVisitorList();
      renderFlowsList();
      renderQuickRepliesTable();
      updateFlowSelectDropdown();
    });

    socket.on('visitor:updated', (updatedVis) => {
      const idx = visitors.findIndex(v => v.id === updatedVis.id);
      if (idx >= 0) {
        visitors[idx] = updatedVis;
      } else {
        visitors.unshift(updatedVis);
        playNotificationSound();
      }
      renderVisitorList();
      if (activeVisitorId === updatedVis.id) {
        updateActiveVisitorHeader(updatedVis);
      }
    });

    socket.on('visitor:status', ({ visitorId, isOnline }) => {
      const vis = visitors.find(v => v.id === visitorId);
      if (vis) {
        vis.isOnline = isOnline;
        renderVisitorList();
        if (activeVisitorId === visitorId) {
          activeVisitorDot.className = `online-dot ${isOnline ? 'online' : ''}`;
        }
      }
    });

    socket.on('message:new', (msg) => {
      if (activeVisitorId === msg.visitorId) {
        appendAdminMessage(msg, true);
        scrollAdminChat();
      }
      if (msg.sender === 'visitor') {
        playNotificationSound();
      }
    });

    socket.on('visitor:cleared', ({ visitorId }) => {
      if (activeVisitorId === visitorId) {
        adminChatFeed.innerHTML = '';
      }
    });

    socket.on('visitor:deleted', ({ visitorId }) => {
      visitors = visitors.filter(v => v.id !== visitorId);
      renderVisitorList();
      if (activeVisitorId === visitorId) {
        resetChatView();
      }
    });
  }

  // --- Render Visitor Sidebar List ---
  function renderVisitorList() {
    const query = visitorSearchInput.value.toLowerCase().trim();
    const filtered = visitors.filter(v => {
      const matchName = (v.name || '').toLowerCase().includes(query);
      const matchPhone = (v.phone || '').toLowerCase().includes(query);
      const matchLast = (v.lastMessage || '').toLowerCase().includes(query);
      return matchName || matchPhone || matchLast;
    });

    visitorList.innerHTML = '';

    let totalUnread = 0;
    visitors.forEach(v => { totalUnread += (v.unreadCount || 0); });
    if (totalUnread > 0) {
      totalUnreadBadge.textContent = totalUnread;
      totalUnreadBadge.style.display = 'inline-block';
    } else {
      totalUnreadBadge.style.display = 'none';
    }

    if (filtered.length === 0) {
      visitorList.innerHTML = `<div class="empty-state" style="padding: 24px; text-align: center; color: #8696a0;">No visitors found</div>`;
      return;
    }

    filtered.forEach(v => {
      const item = document.createElement('div');
      item.className = `visitor-item ${activeVisitorId === v.id ? 'active' : ''}`;
      item.onclick = () => selectVisitor(v.id);

      const hasPhone = !!v.phone;
      const snippet = v.lastMessage || (hasPhone ? `Phone: ${v.phone}` : 'New visitor connected');
      const timeStr = v.lastActive ? new Date(v.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      item.innerHTML = `
        <div class="visitor-item-avatar">
          <img src="/assets/default-avatar.svg" alt="Avatar">
          <span class="status-badge-dot ${v.isOnline ? 'online' : ''}"></span>
        </div>
        <div class="visitor-item-info">
          <div class="visitor-item-row1">
            <span class="visitor-item-name">${escapeHtml(v.name || v.id)}</span>
            <span class="visitor-item-time">${timeStr}</span>
          </div>
          <div class="visitor-item-row2">
            <span class="visitor-item-snippet">${hasPhone ? '📱 ' : ''}${escapeHtml(snippet)}</span>
            ${v.unreadCount > 0 ? `<span class="unread-badge">${v.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      visitorList.appendChild(item);
    });
  }

  visitorSearchInput.addEventListener('input', renderVisitorList);

  // --- Select Visitor ---
  async function selectVisitor(visitorId) {
    activeVisitorId = visitorId;
    renderVisitorList();

    const vis = visitors.find(v => v.id === visitorId);
    if (!vis) return;

    // Mobile layout toggle
    const inboxContainer = document.querySelector('.inbox-container');
    if (inboxContainer) inboxContainer.classList.add('chat-open');

    chatHeaderActions.style.display = 'flex';
    chatPaneFooter.style.display = 'flex';

    updateActiveVisitorHeader(vis);
    populateVisitorDetails(vis);

    socket.emit('admin:select_visitor', { visitorId });

    // Fetch message history
    try {
      const res = await fetch(`/api/visitors/${visitorId}/messages`);
      const messages = await res.json();
      adminChatFeed.innerHTML = '';
      messages.forEach(msg => appendAdminMessage(msg, false));
      scrollAdminChat();
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  function updateActiveVisitorHeader(vis) {
    activeVisitorName.textContent = vis.name || vis.id;
    activeVisitorPhone.textContent = vis.phone ? `📱 ${vis.phone}` : 'No phone saved';
    activeVisitorSource.textContent = vis.source || 'Direct';
    activeVisitorDot.className = `online-dot ${vis.isOnline ? 'online' : ''}`;

    if (vis.phone) {
      activeVisitorLeadBadge.style.display = 'inline-block';
    } else {
      activeVisitorLeadBadge.style.display = 'none';
    }

    // Bot toggle button state
    if (vis.botPaused) {
      toggleVisitorBotBtn.textContent = '⏸️ Bot: Paused (Takeover)';
      toggleVisitorBotBtn.classList.add('paused');
    } else {
      toggleVisitorBotBtn.textContent = '🤖 Bot: Active';
      toggleVisitorBotBtn.classList.remove('paused');
    }
  }

  function populateVisitorDetails(vis) {
    detailVisitorId.textContent = vis.id;
    detailVisitorNameInput.value = vis.name || '';
    detailVisitorPhoneInput.value = vis.phone || '';
    detailVisitorSource.textContent = vis.source || 'Direct Ads';
    detailVisitorCreated.textContent = vis.createdAt ? new Date(vis.createdAt).toLocaleString() : '-';
    detailVisitorActive.textContent = vis.lastActive ? new Date(vis.lastActive).toLocaleString() : '-';

    if (vis.phone) {
      const cleanPhone = vis.phone.replace(/[^0-9]/g, '');
      directWhatsAppLink.href = `https://wa.me/${cleanPhone}`;
      directWhatsAppLink.style.display = 'block';
    } else {
      directWhatsAppLink.style.display = 'none';
    }
  }

  // --- Toggle Bot Pause / Resume for Active Visitor ---
  toggleVisitorBotBtn.addEventListener('click', async () => {
    if (!activeVisitorId) return;
    const vis = visitors.find(v => v.id === activeVisitorId);
    if (!vis) return;

    const newPaused = !vis.botPaused;
    try {
      const res = await fetch(`/api/visitors/${activeVisitorId}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botPaused: newPaused })
      });
      const data = await res.json();
      if (data.visitor) {
        updateActiveVisitorHeader(data.visitor);
      }
    } catch (e) {
      console.error(e);
    }
  });

  // --- Trigger Flow on Demand ---
  function updateFlowSelectDropdown() {
    quickTriggerFlowSelect.innerHTML = `<option value="">⚡ Trigger Funnel...</option>`;
    flows.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      quickTriggerFlowSelect.appendChild(opt);
    });
  }

  quickTriggerFlowSelect.addEventListener('change', () => {
    const flowId = quickTriggerFlowSelect.value;
    if (flowId && activeVisitorId) {
      socket.emit('admin:trigger_flow', { visitorId: activeVisitorId, flowId });
      quickTriggerFlowSelect.value = '';
    }
  });

  // --- Clear Chat ---
  clearChatBtn.addEventListener('click', async () => {
    if (!activeVisitorId) return;
    if (!confirm('Clear entire conversation history for this visitor?')) return;

    try {
      await fetch(`/api/visitors/${activeVisitorId}/clear`, { method: 'POST' });
      adminChatFeed.innerHTML = '';
    } catch (e) {
      console.error(e);
    }
  });

  // --- Reset Chat View Helper ---
  function resetChatView() {
    activeVisitorId = null;
    chatHeaderActions.style.display = 'none';
    chatPaneFooter.style.display = 'none';
    activeVisitorName.textContent = 'Select a conversation';
    activeVisitorPhone.textContent = 'No phone';
    activeVisitorSource.textContent = '';
    activeVisitorLeadBadge.style.display = 'none';
    activeVisitorDot.className = 'online-dot';
    adminChatFeed.innerHTML = `
      <div class="select-hint">
        <div class="hint-icon">💬</div>
        <h3>Select a conversation from the sidebar</h3>
        <p>Monitor real-time visitors, view automated sales funnels, and take over chats live.</p>
      </div>
    `;
    const inboxContainer = document.querySelector('.inbox-container');
    if (inboxContainer) inboxContainer.classList.remove('chat-open');
    if (detailsPane) detailsPane.classList.remove('open');
    if (detailsBackdrop) detailsBackdrop.classList.remove('open');
  }

  // --- Delete Visitor Completely ---
  async function handleDeleteVisitor() {
    if (!activeVisitorId) return;
    const vis = visitors.find(v => v.id === activeVisitorId);
    const visName = vis ? (vis.name || vis.id) : activeVisitorId;

    if (!confirm(`Are you sure you want to permanently delete "${visName}" and all their messages?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/visitors/${activeVisitorId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        visitors = visitors.filter(v => v.id !== activeVisitorId);
        resetChatView();
        renderVisitorList();
      }
    } catch (err) {
      alert('Error deleting visitor: ' + err.message);
    }
  }

  if (deleteVisitorBtn) deleteVisitorBtn.addEventListener('click', handleDeleteVisitor);
  if (detailDeleteVisitorBtn) detailDeleteVisitorBtn.addEventListener('click', handleDeleteVisitor);

  // --- Save Lead Details ---
  saveLeadDetailsBtn.addEventListener('click', async () => {
    if (!activeVisitorId) return;
    const phone = detailVisitorPhoneInput.value.trim();
    const name = detailVisitorNameInput.value.trim();

    try {
      await fetch(`/api/visitors/${activeVisitorId}/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const vis = visitors.find(v => v.id === activeVisitorId);
      if (vis) {
        vis.phone = phone;
        if (name) vis.name = name;
        updateActiveVisitorHeader(vis);
        populateVisitorDetails(vis);
        renderVisitorList();
      }
      alert('Lead details updated successfully!');
    } catch (e) {
      alert('Error updating lead details');
    }
  });

  // --- Send Manual Message ---
  function sendAdminManualMessage() {
    if (!activeVisitorId) return;
    const text = adminMessageInput.value.trim();
    if (!text) return;

    socket.emit('admin:send_message', {
      visitorId: activeVisitorId,
      type: 'text',
      content: text
    });

    adminMessageInput.value = '';
    adminMessageInput.style.height = 'auto';
  }

  adminSendBtn.addEventListener('click', sendAdminManualMessage);

  adminMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAdminManualMessage();
    }
  });

  // --- Admin File Attachment Upload ---
  adminAttachBtn.addEventListener('click', () => adminFileInput.click());

  adminFileInput.addEventListener('change', async () => {
    if (!adminFileInput.files || adminFileInput.files.length === 0 || !activeVisitorId) return;
    const file = adminFileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        const isVideo = file.type.startsWith('video');
        socket.emit('admin:send_message', {
          visitorId: activeVisitorId,
          type: isVideo ? 'video' : 'image',
          content: data.url
        });
      }
    } catch (e) {
      console.error('Admin file upload error:', e);
    }
    adminFileInput.value = '';
  });

  // --- In-Browser Voice Note Recorder ---
  adminMicBtn.addEventListener('click', async () => {
    if (!activeVisitorId) {
      alert('Select a visitor first to record a voice note.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(recordTimerInterval);
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      };

      mediaRecorder.start();
      recordStartTime = Date.now();
      adminVoiceRecordBar.style.display = 'flex';

      recordTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        recordTimer.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      }, 500);

    } catch (err) {
      alert('Microphone access denied or not supported: ' + err.message);
    }
  });

  cancelRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordTimerInterval);
    adminVoiceRecordBar.style.display = 'none';
    audioChunks = [];
  });

  sendVoiceRecordBtn.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    const durationSec = Math.max(1, Math.floor((Date.now() - recordStartTime) / 1000));

    mediaRecorder.onstop = async () => {
      clearInterval(recordTimerInterval);
      adminVoiceRecordBar.style.display = 'none';

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'admin-voice.webm');

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url && activeVisitorId) {
          socket.emit('admin:send_message', {
            visitorId: activeVisitorId,
            type: 'voice',
            content: data.url,
            voiceDuration: durationSec
          });
        }
      } catch (err) {
        console.error('Voice upload error:', err);
      }
    };

    mediaRecorder.stop();
  });

  // --- Render Message in Admin Feed ---
  function appendAdminMessage(msg, animate = true) {
    const isVisitor = msg.sender === 'visitor';
    const row = document.createElement('div');
    row.className = `msg-row ${isVisitor ? 'incoming' : 'outgoing'}`;
    if (!animate) row.style.animation = 'none';

    let contentHtml = '';
    const timeFormatted = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    if (msg.type === 'voice') {
      contentHtml = `
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
          <button style="background: #00a884; color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;" onclick="this.nextElementSibling.paused ? this.nextElementSibling.play() : this.nextElementSibling.pause()">▶</button>
          <audio src="${msg.content}" preload="metadata" style="display:none;"></audio>
          <div>
            <div style="font-size: 13px; font-weight: 600;">🎤 Voice Note (${msg.voiceDuration || 10}s)</div>
            <a href="${msg.content}" target="_blank" style="font-size: 11px; color: #00a884;">Download Audio</a>
          </div>
        </div>
      `;
    } else if (msg.type === 'image') {
      contentHtml = `
        <div style="max-width: 260px;">
          <img src="${msg.content}" style="width: 100%; border-radius: 6px; cursor: pointer;" onclick="window.open('${msg.content}')" alt="Attachment">
          ${msg.caption ? `<div style="margin-top: 4px; font-size: 13px;">${escapeHtml(msg.caption)}</div>` : ''}
        </div>
      `;
    } else if (msg.type === 'video') {
      contentHtml = `
        <div style="max-width: 260px;">
          <video src="${msg.content}" controls style="width: 100%; border-radius: 6px;"></video>
          ${msg.caption ? `<div style="margin-top: 4px; font-size: 13px;">${escapeHtml(msg.caption)}</div>` : ''}
        </div>
      `;
    } else {
      let text = escapeHtml(msg.content);
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\n/g, '<br>');
      contentHtml = `<div class="msg-text">${text}</div>`;
    }

    const senderBadge = msg.sender === 'bot' ? '<span style="font-size: 10px; color: #00a884; font-weight: 700; margin-right: 4px;">[BOT]</span>' : (msg.sender === 'admin' ? '<span style="font-size: 10px; color: #1a73e8; font-weight: 700; margin-right: 4px;">[ADMIN]</span>' : '');

    row.innerHTML = `
      <div class="msg-bubble" style="background: ${isVisitor ? '#ffffff' : (msg.sender === 'bot' ? '#e7f7ed' : '#d9fdd3')}; border-radius: 8px; padding: 6px 10px; max-width: 80%; box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);">
        ${contentHtml}
        <div class="msg-meta" style="font-size: 10.5px; color: #667781; text-align: right; margin-top: 4px;">
          ${senderBadge}
          <span>${timeFormatted}</span>
        </div>
      </div>
    `;

    adminChatFeed.appendChild(row);
  }

  function scrollAdminChat() {
    setTimeout(() => {
      adminChatFeed.scrollTop = adminChatFeed.scrollHeight;
    }, 40);
  }

  // --- 2. FUNNEL FLOWS BUILDER ---
  function renderFlowsList() {
    flowsGrid.innerHTML = '';
    flows.forEach(flow => {
      const card = document.createElement('div');
      card.className = 'flow-card';

      let stepsHtml = '';
      (flow.steps || []).forEach((st, idx) => {
        stepsHtml += `
          <div class="flow-step-pill">
            <span class="step-type-tag">Step ${idx + 1}: ${st.type.toUpperCase()}</span>
            <span class="step-delay-tag">⏳ ${st.delay}s delay</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="flow-card-header">
          <div>
            <h4 class="flow-title">${escapeHtml(flow.name)}</h4>
            <div class="flow-keywords">Triggers: ${escapeHtml((flow.keywords || []).join(', ') || 'Direct button')}</div>
          </div>
          <span class="flow-badge">${flow.triggerType}</span>
        </div>

        <div class="flow-steps-summary">
          ${stepsHtml}
        </div>

        <div class="flow-card-actions">
          <button class="btn-secondary" onclick="window.editFlow('${flow.id}')">✏️ Edit Sequence</button>
          <button class="btn-secondary danger-btn" onclick="window.deleteFlow('${flow.id}')">Delete</button>
        </div>
      `;

      flowsGrid.appendChild(card);
    });
  }

  // Edit / Create Flow Modal
  window.editFlow = function (flowId) {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;

    flowModalTitle.textContent = 'Edit Funnel Flow';
    modalFlowId.value = flow.id;
    modalFlowName.value = flow.name;
    modalFlowTriggerType.value = flow.triggerType || 'quick_reply';
    modalFlowKeywords.value = (flow.keywords || []).join(', ');

    modalStepsList.innerHTML = '';
    (flow.steps || []).forEach(step => addStepCard(step));

    flowModal.style.display = 'flex';
  };

  createNewFlowBtn.addEventListener('click', () => {
    flowModalTitle.textContent = 'Create New Funnel Flow';
    modalFlowId.value = '';
    modalFlowName.value = '';
    modalFlowTriggerType.value = 'quick_reply';
    modalFlowKeywords.value = '';
    modalStepsList.innerHTML = '';
    addStepCard({ delay: 2, type: 'text', content: '', caption: '' });
    flowModal.style.display = 'flex';
  });

  closeFlowModal.addEventListener('click', () => flowModal.style.display = 'none');
  cancelFlowModal.addEventListener('click', () => flowModal.style.display = 'none');

  // Add Step to Flow Modal
  function addStepCard(step = { delay: 3, type: 'text', content: '', caption: '' }) {
    const stepCard = document.createElement('div');
    stepCard.className = 'step-edit-card';
    const stepIdx = modalStepsList.children.length + 1;

    stepCard.innerHTML = `
      <div class="step-card-header">
        <span class="step-index-label">Step #${stepIdx}</span>
        <button type="button" class="btn-remove-step" onclick="this.closest('.step-edit-card').remove()">Remove Step</button>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label>Delay (Seconds before sending)</label>
          <input type="number" class="step-delay-input" min="1" max="120" value="${step.delay || 2}">
        </div>
        <div class="form-group flex-1">
          <label>Content Type</label>
          <select class="step-type-select" onchange="window.updateStepInputVisibility(this)">
            <option value="text" ${step.type === 'text' ? 'selected' : ''}>Text Message</option>
            <option value="voice" ${step.type === 'voice' ? 'selected' : ''}>Voice Note (Audio)</option>
            <option value="image" ${step.type === 'image' ? 'selected' : ''}>Product Image</option>
            <option value="video" ${step.type === 'video' ? 'selected' : ''}>Video Demo</option>
          </select>
        </div>
      </div>

      <div class="form-group step-content-wrap">
        <label>Message Content / Text / Caption</label>
        <textarea class="step-content-input" rows="3" placeholder="Enter message text...">${escapeHtml(step.content || '')}</textarea>
        
        <div class="step-media-upload-row" style="margin-top: 8px; display: ${step.type === 'text' ? 'none' : 'flex'}; gap: 8px;">
          <input type="text" class="step-media-url-input" placeholder="Media URL (/uploads/...) or upload file" value="${step.type !== 'text' ? escapeHtml(step.content || '') : ''}">
          <button type="button" class="btn-secondary" onclick="window.triggerStepFileUpload(this)">📁 Upload</button>
          <input type="file" class="step-file-input" style="display:none;" onchange="window.handleStepFileUpload(this)">
        </div>
      </div>
    `;

    modalStepsList.appendChild(stepCard);
  }

  addStepBtn.addEventListener('click', () => addStepCard());

  window.updateStepInputVisibility = function (select) {
    const card = select.closest('.step-edit-card');
    const mediaRow = card.querySelector('.step-media-upload-row');
    mediaRow.style.display = select.value === 'text' ? 'none' : 'flex';
  };

  window.triggerStepFileUpload = function (btn) {
    const card = btn.closest('.step-edit-card');
    card.querySelector('.step-file-input').click();
  };

  window.handleStepFileUpload = async function (fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        const card = fileInput.closest('.step-edit-card');
        card.querySelector('.step-media-url-input').value = data.url;
        card.querySelector('.step-content-input').value = data.url;
        alert('File uploaded successfully: ' + data.url);
      }
    } catch (e) {
      alert('Upload failed: ' + e.message);
    }
  };

  // Save Flow
  saveFlowModalBtn.addEventListener('click', async () => {
    const id = modalFlowId.value;
    const name = modalFlowName.value.trim();
    if (!name) {
      alert('Please enter a funnel name');
      return;
    }

    const triggerType = modalFlowTriggerType.value;
    const keywords = modalFlowKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

    const stepCards = modalStepsList.querySelectorAll('.step-edit-card');
    const steps = [];

    stepCards.forEach((card, idx) => {
      const delay = parseInt(card.querySelector('.step-delay-input').value) || 2;
      const type = card.querySelector('.step-type-select').value;
      const content = card.querySelector('.step-content-input').value.trim();
      const mediaUrl = card.querySelector('.step-media-url-input').value.trim();

      steps.push({
        id: `step_${idx + 1}`,
        delay,
        type,
        content: type === 'text' ? content : (mediaUrl || content),
        caption: type !== 'text' ? content : '',
        voiceDuration: type === 'voice' ? 14 : 0
      });
    });

    const payload = {
      id: id || ('flow_' + Date.now()),
      name,
      triggerType,
      keywords,
      enabled: true,
      steps
    };

    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const saved = await res.json();
      
      const idx = flows.findIndex(f => f.id === saved.id);
      if (idx >= 0) flows[idx] = saved;
      else flows.push(saved);

      renderFlowsList();
      updateFlowSelectDropdown();
      flowModal.style.display = 'none';
      alert('Funnel Flow saved successfully!');
    } catch (e) {
      alert('Error saving flow: ' + e.message);
    }
  });

  window.deleteFlow = async function (id) {
    if (!confirm('Are you sure you want to delete this funnel?')) return;
    try {
      await fetch(`/api/flows/${id}`, { method: 'DELETE' });
      flows = flows.filter(f => f.id !== id);
      renderFlowsList();
      updateFlowSelectDropdown();
    } catch (e) {
      alert('Error deleting flow');
    }
  };

  // --- 3. QUICK REPLIES MANAGER ---
  function renderQuickRepliesTable() {
    quickRepliesTableBody.innerHTML = '';
    quickReplies.forEach((qr, idx) => {
      const tr = document.createElement('tr');
      const flow = flows.find(f => f.id === qr.flowId);

      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td><input type="text" class="qr-label-input" value="${escapeHtml(qr.label)}" style="width: 100%; padding: 6px; border: 1px solid #d1d7db; border-radius: 6px;"></td>
        <td>
          <select class="qr-flow-select" style="width: 100%; padding: 6px; border: 1px solid #d1d7db; border-radius: 6px;">
            <option value="">-- No Flow --</option>
            ${flows.map(f => `<option value="${f.id}" ${f.id === qr.flowId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
          </select>
        </td>
        <td>
          <button class="btn-secondary danger-btn" onclick="window.deleteQuickReply('${qr.id}')">Delete</button>
        </td>
      `;

      quickRepliesTableBody.appendChild(tr);
    });
  }

  addQuickReplyBtn.addEventListener('click', () => {
    quickReplies.push({
      id: 'qr_' + Date.now(),
      label: '👉 New Action Button',
      flowId: flows[0] ? flows[0].id : '',
      order: quickReplies.length + 1
    });
    renderQuickRepliesTable();
  });

  window.deleteQuickReply = function (id) {
    quickReplies = quickReplies.filter(q => q.id !== id);
    renderQuickRepliesTable();
    saveQuickReplies();
  };

  async function saveQuickReplies() {
    const rows = quickRepliesTableBody.querySelectorAll('tr');
    const updated = [];
    rows.forEach((row, idx) => {
      const label = row.querySelector('.qr-label-input').value.trim();
      const flowId = row.querySelector('.qr-flow-select').value;
      updated.push({
        id: quickReplies[idx] ? quickReplies[idx].id : ('qr_' + idx),
        label,
        flowId,
        order: idx + 1
      });
    });

    try {
      const res = await fetch('/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      quickReplies = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  // --- 4. SETTINGS & BRAND ---
  function populateSettingsForm(s) {
    if (s.brandName) settingBrandName.value = s.brandName;
    if (s.brandSubtitle) settingBrandSubtitle.value = s.brandSubtitle;
    if (s.brandAvatar) settingAvatarPreview.src = s.brandAvatar;
    if (s.soundEnabled !== undefined) settingSoundToggle.checked = !!s.soundEnabled;
    if (s.phonePromptEnabled !== undefined) settingPhonePromptToggle.checked = !!s.phonePromptEnabled;
    if (s.phonePromptDelay) settingPhonePromptDelay.value = s.phonePromptDelay;
    if (s.phonePromptMessage) settingPhonePromptMessage.value = s.phonePromptMessage;
    if (s.fallbackMessage) settingFallbackMessage.value = s.fallbackMessage;
  }

  globalBotToggle.addEventListener('change', async () => {
    const active = globalBotToggle.checked;
    await updateSettingsPayload({ botActive: active });
  });

  saveBrandSettingsBtn.addEventListener('click', async () => {
    const payload = {
      brandName: settingBrandName.value.trim(),
      brandSubtitle: settingBrandSubtitle.value.trim(),
      soundEnabled: settingSoundToggle.checked
    };
    await updateSettingsPayload(payload);
    alert('Brand settings updated!');
  });

  savePromptSettingsBtn.addEventListener('click', async () => {
    const payload = {
      phonePromptEnabled: settingPhonePromptToggle.checked,
      phonePromptDelay: parseInt(settingPhonePromptDelay.value) || 10,
      phonePromptMessage: settingPhonePromptMessage.value.trim(),
      fallbackMessage: settingFallbackMessage.value.trim()
    };
    await updateSettingsPayload(payload);
    alert('Lead settings updated!');
  });

  async function updateSettingsPayload(data) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      settings = await res.json();
    } catch (e) {
      console.error(e);
    }
  }

  uploadAvatarBtn.addEventListener('click', () => avatarFileInput.click());

  avatarFileInput.addEventListener('change', async () => {
    if (!avatarFileInput.files || avatarFileInput.files.length === 0) return;
    const file = avatarFileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        settingAvatarPreview.src = data.url;
        await updateSettingsPayload({ brandAvatar: data.url });
        alert('Avatar updated!');
      }
    } catch (e) {
      alert('Avatar upload failed');
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Mobile Navigation & Drawer Toggles ---
  const adminBackToListBtn = document.getElementById('adminBackToListBtn');
  const adminToggleDetailsBtn = document.getElementById('adminToggleDetailsBtn');
  const detailsPane = document.getElementById('detailsPane');
  const closeDetailsPaneBtn = document.getElementById('closeDetailsPaneBtn');

  // Create mobile details backdrop
  let detailsBackdrop = document.querySelector('.details-backdrop');
  if (!detailsBackdrop) {
    detailsBackdrop = document.createElement('div');
    detailsBackdrop.className = 'details-backdrop';
    document.body.appendChild(detailsBackdrop);
  }

  if (adminBackToListBtn) {
    adminBackToListBtn.addEventListener('click', () => {
      const inboxContainer = document.querySelector('.inbox-container');
      if (inboxContainer) inboxContainer.classList.remove('chat-open');
      if (detailsPane) detailsPane.classList.remove('open');
      if (detailsBackdrop) detailsBackdrop.classList.remove('open');
      activeVisitorId = null;
    });
  }

  if (adminToggleDetailsBtn) {
    adminToggleDetailsBtn.addEventListener('click', () => {
      if (detailsPane) detailsPane.classList.toggle('open');
      if (detailsBackdrop) detailsBackdrop.classList.toggle('open');
    });
  }

  if (closeDetailsPaneBtn) {
    closeDetailsPaneBtn.addEventListener('click', () => {
      if (detailsPane) detailsPane.classList.remove('open');
      if (detailsBackdrop) detailsBackdrop.classList.remove('open');
    });
  }

  detailsBackdrop.addEventListener('click', () => {
    if (detailsPane) detailsPane.classList.remove('open');
    detailsBackdrop.classList.remove('open');
  });

  // --- Admin PWA Installation & Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('✓ Admin PWA Service Worker Registered', reg.scope);
      }).catch((err) => {
        console.log('Admin Service Worker note:', err);
      });
    });
  }

  let adminDeferredPrompt = null;
  const adminPwaInstallBtn = document.getElementById('adminPwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    adminDeferredPrompt = e;
    if (adminPwaInstallBtn) adminPwaInstallBtn.style.display = 'inline-block';
  });

  if (adminPwaInstallBtn) {
    adminPwaInstallBtn.addEventListener('click', async () => {
      if (adminDeferredPrompt) {
        adminDeferredPrompt.prompt();
        const { outcome } = await adminDeferredPrompt.userChoice;
        console.log('Admin install choice:', outcome);
        adminDeferredPrompt = null;
        adminPwaInstallBtn.style.display = 'none';
      } else {
        alert('📲 To install Admin App on your phone:\n\n• On iPhone (Safari): Tap Share (⎋) -> "Add to Home Screen" (⊞)\n• On Android (Chrome): Tap menu (⋮) -> "Install App" or "Add to Home Screen"');
      }
    });
  }

  const isAdminIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isAdminStandalone = () => ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;

  if (isAdminIos() && !isAdminStandalone() && adminPwaInstallBtn) {
    adminPwaInstallBtn.style.display = 'inline-block';
  }

  // Initialize
  connectAdminSocket();

})();
