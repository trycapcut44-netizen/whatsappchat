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
  let currentChatMessages = [];

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
  const adminPasteBtn = document.getElementById('adminPasteBtn');
  const adminVoiceRecordBar = document.getElementById('adminVoiceRecordBar');
  const recordTimer = document.getElementById('recordTimer');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');
  const sendVoiceRecordBtn = document.getElementById('sendVoiceRecordBtn');

  // Details Pane Elements
  const detailVisitorId = document.getElementById('detailVisitorId');
  const detailVisitorAvatar = document.getElementById('detailVisitorAvatar');
  const detailUploadAvatarBtn = document.getElementById('detailUploadAvatarBtn');
  const detailAvatarFileInput = document.getElementById('detailAvatarFileInput');
  const detailVisitorPlatform = document.getElementById('detailVisitorPlatform');
  const detailVisitorNameInput = document.getElementById('detailVisitorNameInput');
  const detailVisitorPhoneInput = document.getElementById('detailVisitorPhoneInput');
  const saveLeadDetailsBtn = document.getElementById('saveLeadDetailsBtn');
  const detailVisitorSource = document.getElementById('detailVisitorSource');
  const detailVisitorCreated = document.getElementById('detailVisitorCreated');
  const detailVisitorActive = document.getElementById('detailVisitorActive');
  const directWhatsAppLink = document.getElementById('directWhatsAppLink');

  // Forward Modal Elements
  const forwardModal = document.getElementById('forwardModal');
  const closeForwardModal = document.getElementById('closeForwardModal');
  const cancelForwardModal = document.getElementById('cancelForwardModal');
  const forwardMsgId = document.getElementById('forwardMsgId');
  const forwardMsgPreviewContent = document.getElementById('forwardMsgPreviewContent');
  const forwardVisitorSearchInput = document.getElementById('forwardVisitorSearchInput');
  const forwardVisitorsList = document.getElementById('forwardVisitorsList');

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

  // Quick Replies & Live Toolbar Elements
  const quickRepliesTableBody = document.getElementById('quickRepliesTableBody');
  const addQuickReplyBtn = document.getElementById('addQuickReplyBtn');
  const adminQuickRepliesToolbar = document.getElementById('adminQuickRepliesToolbar');
  const adminQrChipsWrapper = document.getElementById('adminQrChipsWrapper');

  // Quick Reply Modal Elements
  const quickReplyModal = document.getElementById('quickReplyModal');
  const closeQuickReplyModal = document.getElementById('closeQuickReplyModal');
  const cancelQuickReplyModal = document.getElementById('cancelQuickReplyModal');
  const saveQuickReplyModalBtn = document.getElementById('saveQuickReplyModalBtn');
  const quickReplyModalTitle = document.getElementById('quickReplyModalTitle');
  const modalQrId = document.getElementById('modalQrId');
  const modalQrLabel = document.getElementById('modalQrLabel');
  const modalQrActionType = document.getElementById('modalQrActionType');
  const modalQrDelay = document.getElementById('modalQrDelay');
  const modalQrOrder = document.getElementById('modalQrOrder');

  // Modal Type Sections
  const qrVoiceSection = document.getElementById('qrVoiceSection');
  const qrImageSection = document.getElementById('qrImageSection');
  const qrVideoSection = document.getElementById('qrVideoSection');
  const qrFlowSection = document.getElementById('qrFlowSection');
  const qrTextSection = document.getElementById('qrTextSection');

  // Modal Voice Controls
  const qrRecordVoiceBtn = document.getElementById('qrRecordVoiceBtn');
  const qrUploadVoiceBtn = document.getElementById('qrUploadVoiceBtn');
  const qrAudioFileInput = document.getElementById('qrAudioFileInput');
  const qrVoiceRecordingBar = document.getElementById('qrVoiceRecordingBar');
  const qrRecordTimer = document.getElementById('qrRecordTimer');
  const qrCancelRecordBtn = document.getElementById('qrCancelRecordBtn');
  const qrStopRecordBtn = document.getElementById('qrStopRecordBtn');
  const qrAudioPreviewWrap = document.getElementById('qrAudioPreviewWrap');
  const qrAudioPreviewPlayer = document.getElementById('qrAudioPreviewPlayer');
  const qrAudioDurationLabel = document.getElementById('qrAudioDurationLabel');
  const qrRemoveAudioBtn = document.getElementById('qrRemoveAudioBtn');
  const modalQrAudioUrl = document.getElementById('modalQrAudioUrl');
  const modalQrAudioDuration = document.getElementById('modalQrAudioDuration');

  // Modal Image Controls
  const qrUploadImageBtn = document.getElementById('qrUploadImageBtn');
  const qrImageFileInput = document.getElementById('qrImageFileInput');
  const qrImagePreviewWrap = document.getElementById('qrImagePreviewWrap');
  const qrImagePreview = document.getElementById('qrImagePreview');
  const qrRemoveImageBtn = document.getElementById('qrRemoveImageBtn');
  const modalQrImageUrl = document.getElementById('modalQrImageUrl');
  const modalQrImageCaption = document.getElementById('modalQrImageCaption');

  // Modal Video Controls
  const qrUploadVideoBtn = document.getElementById('qrUploadVideoBtn');
  const qrVideoFileInput = document.getElementById('qrVideoFileInput');
  const qrVideoPreviewWrap = document.getElementById('qrVideoPreviewWrap');
  const qrVideoPreview = document.getElementById('qrVideoPreview');
  const qrRemoveVideoBtn = document.getElementById('qrRemoveVideoBtn');
  const modalQrVideoUrl = document.getElementById('modalQrVideoUrl');
  const modalQrVideoCaption = document.getElementById('modalQrVideoCaption');

  // Modal Flow & Text Controls
  const modalQrFlowSelect = document.getElementById('modalQrFlowSelect');
  const modalQrTextContent = document.getElementById('modalQrTextContent');

  // QR Audio Recording State
  let qrMediaRecorder = null;
  let qrAudioChunks = [];
  let qrRecordStartTime = null;
  let qrRecordTimerInterval = null;

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
      renderAdminChatQuickReplies();
      updateFlowSelectDropdown();
    });

    socket.on('quick_replies:updated', (updated) => {
      quickReplies = updated || [];
      renderQuickRepliesTable();
      renderAdminChatQuickReplies();
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

      let avatarSrc = v.avatar;
      if (!avatarSrc || avatarSrc === '/assets/default-avatar.svg') {
        if (v.platform === 'tiktok') avatarSrc = '/assets/tiktok-avatar.svg';
        else if (v.platform === 'facebook') avatarSrc = '/assets/facebook-avatar.svg';
        else avatarSrc = '/assets/default-avatar.svg';
      }

      let platformBadge = '';
      if (v.platform === 'tiktok') {
        platformBadge = '<span class="platform-badge badge-tiktok" style="font-size: 10px; background: #000; color: #fff; padding: 1px 5px; border-radius: 4px; margin-left: 5px;">🎵 TikTok</span>';
      } else if (v.platform === 'facebook') {
        platformBadge = '<span class="platform-badge badge-facebook" style="font-size: 10px; background: #1877f2; color: #fff; padding: 1px 5px; border-radius: 4px; margin-left: 5px;">🔵 FB</span>';
      }

      item.innerHTML = `
        <div class="visitor-item-avatar">
          <img src="${avatarSrc}" alt="Avatar">
          <span class="status-badge-dot ${v.isOnline ? 'online' : ''}"></span>
        </div>
        <div class="visitor-item-info">
          <div class="visitor-item-row1">
            <span class="visitor-item-name">${escapeHtml(v.name || v.id)}${platformBadge}</span>
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
    if (adminQuickRepliesToolbar) {
      adminQuickRepliesToolbar.style.display = 'flex';
      renderAdminChatQuickReplies();
    }

    updateActiveVisitorHeader(vis);
    populateVisitorDetails(vis);

    socket.emit('admin:select_visitor', { visitorId });

    // Fetch message history
    try {
      const res = await fetch(`/api/visitors/${visitorId}/messages`);
      const messages = await res.json();
      currentChatMessages = messages || [];
      adminChatFeed.innerHTML = '';
      currentChatMessages.forEach(msg => appendAdminMessage(msg, false));
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

    let avatarSrc = vis.avatar;
    if (!avatarSrc || avatarSrc === '/assets/default-avatar.svg') {
      if (vis.platform === 'tiktok') avatarSrc = '/assets/tiktok-avatar.svg';
      else if (vis.platform === 'facebook') avatarSrc = '/assets/facebook-avatar.svg';
      else avatarSrc = '/assets/default-avatar.svg';
    }
    if (activeVisitorAvatar) activeVisitorAvatar.src = avatarSrc;

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

    let avatarSrc = vis.avatar;
    if (!avatarSrc || avatarSrc === '/assets/default-avatar.svg') {
      if (vis.platform === 'tiktok') avatarSrc = '/assets/tiktok-avatar.svg';
      else if (vis.platform === 'facebook') avatarSrc = '/assets/facebook-avatar.svg';
      else avatarSrc = '/assets/default-avatar.svg';
    }
    if (detailVisitorAvatar) detailVisitorAvatar.src = avatarSrc;
    if (detailVisitorPlatform) {
      if (vis.platform === 'tiktok') detailVisitorPlatform.textContent = '🎵 TikTok Traffic';
      else if (vis.platform === 'facebook') detailVisitorPlatform.textContent = '🔵 Facebook Traffic';
      else detailVisitorPlatform.textContent = vis.source || 'Direct Ads';
    }

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
    if (adminQuickRepliesToolbar) adminQuickRepliesToolbar.style.display = 'none';
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

  // --- Save Lead & Profile Details ---
  saveLeadDetailsBtn.addEventListener('click', async () => {
    if (!activeVisitorId) return;
    const phone = detailVisitorPhoneInput.value.trim();
    const name = detailVisitorNameInput.value.trim();
    const avatar = detailVisitorAvatar ? detailVisitorAvatar.src : '';

    try {
      const res = await fetch(`/api/visitors/${activeVisitorId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, avatar })
      });
      const data = await res.json();
      if (data.visitor) {
        const idx = visitors.findIndex(v => v.id === activeVisitorId);
        if (idx !== -1) visitors[idx] = data.visitor;
        updateActiveVisitorHeader(data.visitor);
        populateVisitorDetails(data.visitor);
        renderVisitorList();
      }
      alert('Lead & profile details updated successfully!');
    } catch (e) {
      alert('Error updating lead details: ' + e.message);
    }
  });

  // --- Change Visitor DP / Avatar File Upload ---
  if (detailUploadAvatarBtn && detailAvatarFileInput) {
    detailUploadAvatarBtn.addEventListener('click', () => detailAvatarFileInput.click());
    detailAvatarFileInput.addEventListener('change', async () => {
      if (!detailAvatarFileInput.files || detailAvatarFileInput.files.length === 0 || !activeVisitorId) return;
      const file = detailAvatarFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          if (detailVisitorAvatar) detailVisitorAvatar.src = data.url;
          if (activeVisitorAvatar) activeVisitorAvatar.src = data.url;

          const profRes = await fetch(`/api/visitors/${activeVisitorId}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: data.url })
          });
          const profData = await profRes.json();
          if (profData.visitor) {
            const idx = visitors.findIndex(v => v.id === activeVisitorId);
            if (idx !== -1) visitors[idx] = profData.visitor;
            renderVisitorList();
          }
        }
      } catch (err) {
        alert('Failed to upload visitor DP: ' + err.message);
      }
      detailAvatarFileInput.value = '';
    });
  }

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

  // --- Paste from Clipboard into Admin Input ---
  if (adminPasteBtn) {
    adminPasteBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            adminMessageInput.value = (adminMessageInput.value ? adminMessageInput.value + ' ' : '') + text;
            adminMessageInput.focus();
          }
        } else {
          adminMessageInput.focus();
          document.execCommand('paste');
        }
      } catch (err) {
        alert('Clipboard access denied or unavailable. Please use Ctrl+V to paste.');
      }
    });
  }

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

    // Forwarded tag indicator
    let forwardedHtml = '';
    if (msg.isForwarded) {
      forwardedHtml = `
        <div class="msg-forwarded-tag">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M7.5 3.5v2.793A6.5 6.5 0 0 0 1.5 12.5a6.5 6.5 0 0 1 6-5.207V10l5.5-3.25L7.5 3.5z"/>
          </svg>
          Forwarded
        </div>
      `;
    }

    const copyPayload = (msg.content || '') + (msg.caption ? ' ' + msg.caption : '');
    const encodedPayload = encodeURIComponent(copyPayload);

    const actionsHtml = `
      <div class="msg-bubble-actions">
        <button type="button" class="bubble-act-btn" title="Copy text" onclick="window.copyAdminMessage(this, decodeURIComponent('${encodedPayload}'))">📋</button>
        <button type="button" class="bubble-act-btn" title="Forward message" onclick="window.openForwardModal('${msg.id}')">↪️</button>
      </div>
    `;

    row.innerHTML = `
      <div class="msg-bubble" style="position: relative; background: ${isVisitor ? '#ffffff' : (msg.sender === 'bot' ? '#e7f7ed' : '#d9fdd3')}; border-radius: 8px; padding: 6px 10px; max-width: 80%; box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);">
        ${forwardedHtml}
        ${contentHtml}
        <div class="msg-meta" style="font-size: 10.5px; color: #667781; text-align: right; margin-top: 4px;">
          ${senderBadge}
          <span>${timeFormatted}</span>
        </div>
        ${actionsHtml}
      </div>
    `;

    adminChatFeed.appendChild(row);
  }

  function scrollAdminChat() {
    setTimeout(() => {
      adminChatFeed.scrollTop = adminChatFeed.scrollHeight;
    }, 40);
  }

  // --- Copy Message Helper for Admin ---
  window.copyAdminMessage = function (btn, text) {
    if (!text) return;
    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        const orig = btn.innerText;
        btn.innerText = '✔';
        setTimeout(() => { btn.innerText = orig; }, 1500);
      } catch (e) {}
      document.body.removeChild(ta);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerText;
        btn.innerText = '✔';
        setTimeout(() => { btn.innerText = orig; }, 1500);
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  // --- Forward Message Modal Logic ---
  window.openForwardModal = function (msgId) {
    const msg = currentChatMessages.find(m => m.id === msgId);
    if (!msg) {
      alert('Message not found.');
      return;
    }
    forwardMsgId.value = msgId;

    let preview = msg.content || '';
    if (msg.type === 'voice') preview = `🎤 Voice Note (${msg.voiceDuration || 10}s)`;
    else if (msg.type === 'image') preview = `📸 Photo ${msg.caption ? '• ' + msg.caption : ''}`;
    else if (msg.type === 'video') preview = `🎥 Video ${msg.caption ? '• ' + msg.caption : ''}`;

    forwardMsgPreviewContent.textContent = preview;
    renderForwardVisitorsList();
    forwardModal.style.display = 'flex';
  };

  function renderForwardVisitorsList() {
    const query = (forwardVisitorSearchInput.value || '').toLowerCase().trim();
    const list = visitors.filter(v => {
      const matchName = (v.name || '').toLowerCase().includes(query);
      const matchPhone = (v.phone || '').toLowerCase().includes(query);
      return matchName || matchPhone;
    });

    forwardVisitorsList.innerHTML = '';
    if (list.length === 0) {
      forwardVisitorsList.innerHTML = `<div style="padding: 16px; text-align: center; color: #8696a0; font-size: 13px;">No contacts found</div>`;
      return;
    }

    list.forEach(v => {
      let avatarSrc = v.avatar;
      if (!avatarSrc || avatarSrc === '/assets/default-avatar.svg') {
        if (v.platform === 'tiktok') avatarSrc = '/assets/tiktok-avatar.svg';
        else if (v.platform === 'facebook') avatarSrc = '/assets/facebook-avatar.svg';
        else avatarSrc = '/assets/default-avatar.svg';
      }

      const item = document.createElement('div');
      item.className = 'forward-visitor-item';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${avatarSrc}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
          <div>
            <div style="font-weight: 600; font-size: 13.5px; color: #111b21;">${escapeHtml(v.name || v.id)}</div>
            <div style="font-size: 11.5px; color: #667781;">${v.phone ? '📱 ' + escapeHtml(v.phone) : (v.platform === 'tiktok' ? '🎵 TikTok' : (v.platform === 'facebook' ? '🔵 FB' : 'Direct'))}</div>
          </div>
        </div>
        <button type="button" class="btn-forward-send" data-target-id="${v.id}">Send ↪</button>
      `;

      item.querySelector('.btn-forward-send').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const targetId = btn.dataset.targetId;
        const msgId = forwardMsgId.value;
        const originalMsg = currentChatMessages.find(m => m.id === msgId);

        socket.emit('admin:forward_message', {
          targetVisitorId: targetId,
          originalMessageId: msgId,
          type: originalMsg ? originalMsg.type : 'text',
          content: originalMsg ? originalMsg.content : '',
          caption: originalMsg ? originalMsg.caption : '',
          voiceDuration: originalMsg ? originalMsg.voiceDuration : 0
        });

        btn.textContent = 'Sent ✔';
        btn.style.background = '#00a884';
        setTimeout(() => {
          forwardModal.style.display = 'none';
        }, 500);
      });

      forwardVisitorsList.appendChild(item);
    });
  }

  if (forwardVisitorSearchInput) {
    forwardVisitorSearchInput.addEventListener('input', renderForwardVisitorsList);
  }
  if (closeForwardModal) {
    closeForwardModal.addEventListener('click', () => { forwardModal.style.display = 'none'; });
  }
  if (cancelForwardModal) {
    cancelForwardModal.addEventListener('click', () => { forwardModal.style.display = 'none'; });
  }
  if (forwardModal) {
    forwardModal.addEventListener('click', (e) => {
      if (e.target === forwardModal) forwardModal.style.display = 'none';
    });
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
        
        <div class="step-media-upload-row" style="margin-top: 8px; display: ${step.type === 'text' ? 'none' : 'flex'}; gap: 8px; align-items: center;">
          <input type="text" class="step-media-url-input" placeholder="Media URL (/uploads/...) or upload file" value="${step.type !== 'text' ? escapeHtml(step.content || '') : ''}">
          <button type="button" class="btn-action-mic step-rec-btn" style="padding: 6px 10px; font-size: 12px; display: ${step.type === 'voice' ? 'inline-flex' : 'none'};" onclick="window.recordStepAudio(this)">🎤 Record</button>
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
    const recBtn = card.querySelector('.step-rec-btn');
    if (recBtn) recBtn.style.display = select.value === 'voice' ? 'inline-flex' : 'none';
  };

  let stepMediaRecorder = null;
  let stepAudioChunks = [];
  window.recordStepAudio = async function (btn) {
    const card = btn.closest('.step-edit-card');
    if (btn.classList.contains('recording')) {
      // Stop recording
      btn.classList.remove('recording');
      btn.textContent = '⏳ Saving...';
      if (stepMediaRecorder && stepMediaRecorder.state !== 'inactive') {
        stepMediaRecorder.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stepAudioChunks = [];
      stepMediaRecorder = new MediaRecorder(stream);
      stepMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) stepAudioChunks.push(e.data);
      };
      stepMediaRecorder.onstop = async () => {
        btn.textContent = '🎤 Record';
        const blob = new Blob(stepAudioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'step-voice.webm');
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) {
            card.querySelector('.step-media-url-input').value = data.url;
            card.querySelector('.step-content-input').value = data.url;
            alert('Voice recorded & saved successfully!');
          }
        } catch (err) {
          alert('Upload failed: ' + err.message);
        }
      };
      stepMediaRecorder.start();
      btn.classList.add('recording');
      btn.textContent = '⏹ Stop & Save';
    } catch (e) {
      alert('Microphone error: ' + e.message);
    }
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

  // --- 3. QUICK REPLIES MANAGER (VOICE RECORD, VOICE UPLOAD, PIC UPLOAD, VIDEO UPLOAD) ---

  function getQrActionType(qr) {
    return qr.actionType || (qr.flowId ? 'flow' : (qr.type || 'text'));
  }

  function renderQuickRepliesTable() {
    quickRepliesTableBody.innerHTML = '';
    quickReplies.forEach((qr, idx) => {
      const tr = document.createElement('tr');
      const actionType = getQrActionType(qr);
      const flow = flows.find(f => f.id === qr.flowId);

      // Badge HTML
      let badgeHtml = '';
      if (actionType === 'voice') {
        badgeHtml = `<span class="qr-type-badge qr-badge-voice">🎤 Voice Note</span>`;
      } else if (actionType === 'image') {
        badgeHtml = `<span class="qr-type-badge qr-badge-image">📸 Picture</span>`;
      } else if (actionType === 'video') {
        badgeHtml = `<span class="qr-type-badge qr-badge-video">🎥 Video Demo</span>`;
      } else if (actionType === 'flow') {
        badgeHtml = `<span class="qr-type-badge qr-badge-flow">⚡ Funnel Flow</span>`;
      } else {
        badgeHtml = `<span class="qr-type-badge qr-badge-text">💬 Direct Text</span>`;
      }

      // Media / Content preview cell
      let mediaPreviewHtml = '';
      if (actionType === 'voice') {
        const audioSrc = qr.content || '';
        const dur = qr.voiceDuration ? `${qr.voiceDuration}s` : 'Audio';
        mediaPreviewHtml = `
          <div class="qr-media-cell">
            ${audioSrc ? `
              <button class="qr-mini-audio-btn" type="button" onclick="const a=new Audio('${audioSrc}'); a.play();" title="Play Voice Preview">▶</button>
              <span style="font-size: 12.5px; font-weight: 600; color: #0b8043;">🎤 ${dur}</span>
            ` : '<span style="font-size: 12px; color: #8696a0;">No audio attached</span>'}
          </div>
        `;
      } else if (actionType === 'image') {
        const imgSrc = qr.content || '';
        mediaPreviewHtml = `
          <div class="qr-media-cell">
            ${imgSrc ? `<img src="${imgSrc}" class="qr-mini-thumb" alt="Preview" onclick="window.open('${imgSrc}')">` : ''}
            <span style="font-size: 12px; color: #54656f;">${escapeHtml(qr.caption || 'Photo attached')}</span>
          </div>
        `;
      } else if (actionType === 'video') {
        const vidSrc = qr.content || '';
        mediaPreviewHtml = `
          <div class="qr-media-cell">
            <span style="font-size: 18px;">🎥</span>
            <span style="font-size: 12px; color: #54656f;">${escapeHtml(qr.caption || 'Video demo attached')}</span>
          </div>
        `;
      } else if (actionType === 'flow') {
        mediaPreviewHtml = `<span style="font-size: 12.5px; font-weight: 500; color: #111b21;">⚡ ${escapeHtml(flow ? flow.name : (qr.flowId || 'None'))}</span>`;
      } else {
        const txtSnippet = (qr.content || '').substring(0, 35);
        mediaPreviewHtml = `<span style="font-size: 12px; color: #54656f;">"${escapeHtml(txtSnippet)}${txtSnippet.length >= 35 ? '...' : ''}"</span>`;
      }

      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight: 600; font-size: 13.5px; color: #111b21;">${escapeHtml(qr.label)}</div>
        </td>
        <td>${badgeHtml}</td>
        <td>${mediaPreviewHtml}</td>
        <td><span style="font-size: 12px; color: #54656f;">${qr.delay || 2}s</span></td>
        <td style="text-align: right;">
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="window.editQuickReply('${qr.id}')">✏️ Edit</button>
          <button class="btn-secondary danger-btn" style="padding: 4px 8px; font-size: 12px;" onclick="window.deleteQuickReply('${qr.id}')">🗑️</button>
        </td>
      `;

      quickRepliesTableBody.appendChild(tr);
    });
  }

  // --- Render Live Chat Quick Replies Toolbar (in Active Chat Pane) ---
  function renderAdminChatQuickReplies() {
    if (!adminQrChipsWrapper) return;
    adminQrChipsWrapper.innerHTML = '';

    if (!quickReplies || quickReplies.length === 0) {
      adminQrChipsWrapper.innerHTML = `<span style="font-size: 12px; color: #8696a0;">No quick replies configured yet. Add them in Quick Replies tab.</span>`;
      return;
    }

    quickReplies.forEach(qr => {
      const actionType = getQrActionType(qr);
      let icon = '⚡';
      if (actionType === 'voice') icon = '🎤';
      else if (actionType === 'image') icon = '📸';
      else if (actionType === 'video') icon = '🎥';
      else if (actionType === 'text') icon = '💬';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-qr-chip-btn';
      btn.innerHTML = `<span>${icon}</span> <span>${escapeHtml(qr.label)}</span>`;
      btn.title = `Click to send "${qr.label}" to client`;

      btn.addEventListener('click', () => {
        if (!activeVisitorId) {
          alert('Please select a conversation from the sidebar first.');
          return;
        }

        socket.emit('admin:trigger_quick_reply', {
          visitorId: activeVisitorId,
          qrId: qr.id
        });
      });

      adminQrChipsWrapper.appendChild(btn);
    });
  }

  // Modal Section Visibility Switcher
  function updateQrModalSectionVisibility(actionType) {
    if (qrVoiceSection) qrVoiceSection.style.display = actionType === 'voice' ? 'block' : 'none';
    if (qrImageSection) qrImageSection.style.display = actionType === 'image' ? 'block' : 'none';
    if (qrVideoSection) qrVideoSection.style.display = actionType === 'video' ? 'block' : 'none';
    if (qrFlowSection) qrFlowSection.style.display = actionType === 'flow' ? 'block' : 'none';
    if (qrTextSection) qrTextSection.style.display = actionType === 'text' ? 'block' : 'none';
  }

  if (modalQrActionType) {
    modalQrActionType.addEventListener('change', () => {
      updateQrModalSectionVisibility(modalQrActionType.value);
    });
  }

  // Populate Flow Dropdown inside QR Modal
  function populateQrFlowSelect(selectedId = '') {
    if (!modalQrFlowSelect) return;
    modalQrFlowSelect.innerHTML = `<option value="">-- Select a Funnel Flow --</option>`;
    flows.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === selectedId) opt.selected = true;
      modalQrFlowSelect.appendChild(opt);
    });
  }

  // Open QR Modal (Add or Edit)
  function openQuickReplyModal(qr = null) {
    // Reset any ongoing recording
    stopQrRecordingClean();

    populateQrFlowSelect(qr ? qr.flowId : '');

    if (qr) {
      quickReplyModalTitle.textContent = 'Edit Quick Reply';
      modalQrId.value = qr.id;
      modalQrLabel.value = qr.label || '';
      const actionType = getQrActionType(qr);
      modalQrActionType.value = actionType;
      modalQrDelay.value = qr.delay || 2;
      modalQrOrder.value = qr.order || 1;

      // Voice
      modalQrAudioUrl.value = (actionType === 'voice') ? (qr.content || '') : '';
      modalQrAudioDuration.value = qr.voiceDuration || 0;
      if (actionType === 'voice' && qr.content) {
        qrAudioPreviewPlayer.src = qr.content;
        qrAudioDurationLabel.textContent = `Duration: ${qr.voiceDuration || 0}s`;
        qrAudioPreviewWrap.style.display = 'block';
      } else {
        qrAudioPreviewPlayer.src = '';
        qrAudioPreviewWrap.style.display = 'none';
      }

      // Image
      modalQrImageUrl.value = (actionType === 'image') ? (qr.content || '') : '';
      modalQrImageCaption.value = (actionType === 'image') ? (qr.caption || '') : '';
      if (actionType === 'image' && qr.content) {
        qrImagePreview.src = qr.content;
        qrImagePreviewWrap.style.display = 'block';
      } else {
        qrImagePreview.src = '';
        qrImagePreviewWrap.style.display = 'none';
      }

      // Video
      modalQrVideoUrl.value = (actionType === 'video') ? (qr.content || '') : '';
      modalQrVideoCaption.value = (actionType === 'video') ? (qr.caption || '') : '';
      if (actionType === 'video' && qr.content) {
        qrVideoPreview.src = qr.content;
        qrVideoPreviewWrap.style.display = 'block';
      } else {
        qrVideoPreview.src = '';
        qrVideoPreviewWrap.style.display = 'none';
      }

      // Flow
      if (modalQrFlowSelect && qr.flowId) {
        modalQrFlowSelect.value = qr.flowId;
      }

      // Text
      modalQrTextContent.value = (actionType === 'text') ? (qr.content || '') : '';

      updateQrModalSectionVisibility(actionType);
    } else {
      quickReplyModalTitle.textContent = 'Add New Quick Reply';
      modalQrId.value = '';
      modalQrLabel.value = '';
      modalQrActionType.value = 'voice';
      modalQrDelay.value = 2;
      modalQrOrder.value = quickReplies.length + 1;

      modalQrAudioUrl.value = '';
      modalQrAudioDuration.value = '0';
      qrAudioPreviewPlayer.src = '';
      qrAudioPreviewWrap.style.display = 'none';

      modalQrImageUrl.value = '';
      modalQrImageCaption.value = '';
      qrImagePreview.src = '';
      qrImagePreviewWrap.style.display = 'none';

      modalQrVideoUrl.value = '';
      modalQrVideoCaption.value = '';
      qrVideoPreview.src = '';
      qrVideoPreviewWrap.style.display = 'none';

      if (modalQrFlowSelect) modalQrFlowSelect.value = flows[0] ? flows[0].id : '';
      modalQrTextContent.value = '';

      updateQrModalSectionVisibility('voice');
    }

    quickReplyModal.style.display = 'flex';
  }

  // Close QR Modal
  function closeQrModal() {
    stopQrRecordingClean();
    quickReplyModal.style.display = 'none';
  }

  if (closeQuickReplyModal) closeQuickReplyModal.addEventListener('click', closeQrModal);
  if (cancelQuickReplyModal) cancelQuickReplyModal.addEventListener('click', closeQrModal);
  if (addQuickReplyBtn) addQuickReplyBtn.addEventListener('click', () => openQuickReplyModal(null));

  window.editQuickReply = function (id) {
    const qr = quickReplies.find(q => q.id === id);
    if (qr) openQuickReplyModal(qr);
  };

  // --- Voice Note Recording inside Modal ---
  function stopQrRecordingClean() {
    if (qrMediaRecorder && qrMediaRecorder.state !== 'inactive') {
      try { qrMediaRecorder.stop(); } catch (e) {}
    }
    clearInterval(qrRecordTimerInterval);
    if (qrVoiceRecordingBar) qrVoiceRecordingBar.style.display = 'none';
    qrAudioChunks = [];
  }

  if (qrRecordVoiceBtn) {
    qrRecordVoiceBtn.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        qrAudioChunks = [];
        qrMediaRecorder = new MediaRecorder(stream);

        qrMediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) qrAudioChunks.push(e.data);
        };

        qrMediaRecorder.onstart = () => {
          qrRecordStartTime = Date.now();
          qrVoiceRecordingBar.style.display = 'flex';
          qrRecordTimer.textContent = '00:00';
          qrRecordTimerInterval = setInterval(() => {
            const elapsedSec = Math.floor((Date.now() - qrRecordStartTime) / 1000);
            const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
            const s = String(elapsedSec % 60).padStart(2, '0');
            qrRecordTimer.textContent = `${m}:${s}`;
          }, 1000);
        };

        qrMediaRecorder.start();
      } catch (err) {
        alert('Microphone access denied or unavailable: ' + err.message);
      }
    });
  }

  if (qrCancelRecordBtn) {
    qrCancelRecordBtn.addEventListener('click', () => {
      stopQrRecordingClean();
    });
  }

  if (qrStopRecordBtn) {
    qrStopRecordBtn.addEventListener('click', () => {
      if (!qrMediaRecorder || qrMediaRecorder.state === 'inactive') return;
      const durationSec = Math.max(1, Math.floor((Date.now() - qrRecordStartTime) / 1000));

      qrMediaRecorder.onstop = async () => {
        clearInterval(qrRecordTimerInterval);
        qrVoiceRecordingBar.style.display = 'none';

        const audioBlob = new Blob(qrAudioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'quickreply-voice.webm');

        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) {
            modalQrAudioUrl.value = data.url;
            modalQrAudioDuration.value = durationSec;
            qrAudioPreviewPlayer.src = data.url;
            qrAudioDurationLabel.textContent = `Recorded: ${durationSec}s`;
            qrAudioPreviewWrap.style.display = 'block';
          }
        } catch (e) {
          alert('Upload failed: ' + e.message);
        }
      };

      qrMediaRecorder.stop();
    });
  }

  // --- Voice File Upload inside Modal ---
  if (qrUploadVoiceBtn && qrAudioFileInput) {
    qrUploadVoiceBtn.addEventListener('click', () => qrAudioFileInput.click());

    qrAudioFileInput.addEventListener('change', async () => {
      if (!qrAudioFileInput.files || qrAudioFileInput.files.length === 0) return;
      const file = qrAudioFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          modalQrAudioUrl.value = data.url;
          qrAudioPreviewPlayer.src = data.url;
          qrAudioPreviewWrap.style.display = 'block';

          // Detect audio duration
          const tempAudio = new Audio(data.url);
          tempAudio.addEventListener('loadedmetadata', () => {
            const dur = Math.round(tempAudio.duration) || 5;
            modalQrAudioDuration.value = dur;
            qrAudioDurationLabel.textContent = `Duration: ${dur}s`;
          });
        }
      } catch (e) {
        alert('Audio upload failed: ' + e.message);
      }
      qrAudioFileInput.value = '';
    });
  }

  if (qrRemoveAudioBtn) {
    qrRemoveAudioBtn.addEventListener('click', () => {
      modalQrAudioUrl.value = '';
      modalQrAudioDuration.value = '0';
      qrAudioPreviewPlayer.src = '';
      qrAudioPreviewWrap.style.display = 'none';
    });
  }

  // --- Image Upload inside Modal ---
  if (qrUploadImageBtn && qrImageFileInput) {
    qrUploadImageBtn.addEventListener('click', () => qrImageFileInput.click());

    qrImageFileInput.addEventListener('change', async () => {
      if (!qrImageFileInput.files || qrImageFileInput.files.length === 0) return;
      const file = qrImageFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          modalQrImageUrl.value = data.url;
          qrImagePreview.src = data.url;
          qrImagePreviewWrap.style.display = 'block';
        }
      } catch (e) {
        alert('Image upload failed: ' + e.message);
      }
      qrImageFileInput.value = '';
    });
  }

  if (qrRemoveImageBtn) {
    qrRemoveImageBtn.addEventListener('click', () => {
      modalQrImageUrl.value = '';
      qrImagePreview.src = '';
      qrImagePreviewWrap.style.display = 'none';
    });
  }

  // --- Video Upload inside Modal ---
  if (qrUploadVideoBtn && qrVideoFileInput) {
    qrUploadVideoBtn.addEventListener('click', () => qrVideoFileInput.click());

    qrVideoFileInput.addEventListener('change', async () => {
      if (!qrVideoFileInput.files || qrVideoFileInput.files.length === 0) return;
      const file = qrVideoFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          modalQrVideoUrl.value = data.url;
          qrVideoPreview.src = data.url;
          qrVideoPreviewWrap.style.display = 'block';
        }
      } catch (e) {
        alert('Video upload failed: ' + e.message);
      }
      qrVideoFileInput.value = '';
    });
  }

  if (qrRemoveVideoBtn) {
    qrRemoveVideoBtn.addEventListener('click', () => {
      modalQrVideoUrl.value = '';
      qrVideoPreview.src = '';
      qrVideoPreviewWrap.style.display = 'none';
    });
  }

  // --- Save Quick Reply from Modal ---
  if (saveQuickReplyModalBtn) {
    saveQuickReplyModalBtn.addEventListener('click', async () => {
      const label = modalQrLabel.value.trim();
      if (!label) {
        alert('Please enter a button label (e.g. 🎤 Voice Details)');
        return;
      }

      const id = modalQrId.value || ('qr_' + Date.now());
      const actionType = modalQrActionType.value;
      const delay = Math.max(1, parseInt(modalQrDelay.value) || 2);
      const order = parseInt(modalQrOrder.value) || (quickReplies.length + 1);

      let content = '';
      let caption = '';
      let flowId = '';
      let voiceDuration = 0;

      if (actionType === 'voice') {
        content = modalQrAudioUrl.value.trim();
        voiceDuration = parseInt(modalQrAudioDuration.value) || 5;
        if (!content) {
          alert('Please record or upload a voice note first!');
          return;
        }
      } else if (actionType === 'image') {
        content = modalQrImageUrl.value.trim();
        caption = modalQrImageCaption.value.trim();
        if (!content) {
          alert('Please upload a picture first!');
          return;
        }
      } else if (actionType === 'video') {
        content = modalQrVideoUrl.value.trim();
        caption = modalQrVideoCaption.value.trim();
        if (!content) {
          alert('Please upload a video file first!');
          return;
        }
      } else if (actionType === 'flow') {
        flowId = modalQrFlowSelect.value;
        if (!flowId) {
          alert('Please select a Funnel Flow!');
          return;
        }
      } else if (actionType === 'text') {
        content = modalQrTextContent.value.trim();
        if (!content) {
          alert('Please enter message text!');
          return;
        }
      }

      const qrItem = {
        id,
        label,
        actionType,
        type: actionType,
        content,
        caption,
        flowId,
        voiceDuration,
        delay,
        order
      };

      const existingIdx = quickReplies.findIndex(q => q.id === id);
      if (existingIdx >= 0) {
        quickReplies[existingIdx] = qrItem;
      } else {
        quickReplies.push(qrItem);
      }

      quickReplies.sort((a, b) => (a.order || 0) - (b.order || 0));

      try {
        const res = await fetch('/api/quick-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quickReplies)
        });
        quickReplies = await res.json();
        renderQuickRepliesTable();
        renderAdminChatQuickReplies();
        closeQrModal();
      } catch (err) {
        alert('Failed to save quick replies: ' + err.message);
      }
    });
  }

  // Delete Quick Reply
  window.deleteQuickReply = async function (id) {
    if (!confirm('Are you sure you want to delete this Quick Reply button?')) return;
    quickReplies = quickReplies.filter(q => q.id !== id);
    renderQuickRepliesTable();
    renderAdminChatQuickReplies();

    try {
      const res = await fetch('/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickReplies)
      });
      quickReplies = await res.json();
    } catch (e) {
      console.error(e);
    }
  };

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
