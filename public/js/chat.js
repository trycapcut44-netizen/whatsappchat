/**
 * WhatsApp Visitor Chat Client
 * Ultra-fast Vanilla JS - zero bloated libraries
 */

(function () {
  'use strict';

  // --- Session & State ---
  let visitorId = localStorage.getItem('wa_visitor_id');
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('wa_visitor_id', visitorId);
  }

  // Parse UTM / Ads Source
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || urlParams.get('source') || (document.referrer ? 'Referrer: ' + new URL(document.referrer).hostname : 'Direct Traffic');

  let socket = null;
  let settings = {};
  let currentAudios = new Map(); // audioId -> { audio, interval, bars }
  let audioContext = null;

  // DOM Elements
  const chatFeed = document.getElementById('chatFeed');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerAgentName = document.getElementById('headerAgentName');
  const statusText = document.getElementById('statusText');
  const typingIndicator = document.getElementById('typingIndicator');
  const typingStatusLabel = document.getElementById('typingStatusLabel');
  const quickRepliesBar = document.getElementById('quickRepliesBar');
  const phonePromptCard = document.getElementById('phonePromptCard');
  const phonePromptForm = document.getElementById('phonePromptForm');
  const promptPhoneInput = document.getElementById('promptPhoneInput');
  const mediaLightbox = document.getElementById('mediaLightbox');
  const lightboxBody = document.getElementById('lightboxBody');
  const closeLightbox = document.getElementById('closeLightbox');
  
  // Visitor Voice Recording Elements
  const visitorMicBtn = document.getElementById('visitorMicBtn');
  const visitorVoiceBar = document.getElementById('visitorVoiceBar');
  const visitorRecordTimer = document.getElementById('visitorRecordTimer');
  const cancelVisitorRecordBtn = document.getElementById('cancelVisitorRecordBtn');
  const sendVisitorRecordBtn = document.getElementById('sendVisitorRecordBtn');

  let visitorMediaRecorder = null;
  let visitorAudioChunks = [];
  let visitorRecordStartTime = null;
  let visitorRecordInterval = null;

  // --- Web Audio API WhatsApp Sound Synthesizer ---
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  // Realistic WhatsApp Incoming Message Tone (Pleasant dual tone)
  function playIncomingChime() {
    try {
      initAudioContext();
      if (!audioContext || (settings.soundEnabled === false)) return;

      const now = audioContext.currentTime;
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // First beep 880Hz, second beep 1320Hz (harmonic WhatsApp tone)
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      osc2.frequency.setValueAtTime(1760, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(2200, now + 0.16);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioContext.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    } catch (e) {
      console.warn('Audio synthesis note:', e);
    }
  }

  // Outgoing subtle pop
  function playOutgoingPop() {
    try {
      initAudioContext();
      if (!audioContext || (settings.soundEnabled === false)) return;

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  // User interaction unlock for audio
  window.addEventListener('click', initAudioContext, { once: true });
  window.addEventListener('touchstart', initAudioContext, { once: true });

  // --- Socket Connection ---
  function connectSocket() {
    socket = io();

    socket.on('connect', () => {
      socket.emit('visitor:join', {
        visitorId: visitorId,
        source: utmSource,
        referrer: document.referrer
      });
    });

    socket.on('visitor:init_data', (data) => {
      settings = data.settings || {};
      applySettings(settings);
      renderQuickReplies(data.quickReplies || []);
      
      // Clear feed and render message history
      chatFeed.innerHTML = `
        <div class="date-divider">
          <span>TODAY</span>
        </div>
      `;

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => appendMessage(msg, false));
        scrollToBottom();
      }

      // Check if visitor already gave phone number
      if (data.visitor && data.visitor.phone) {
        phonePromptCard.style.display = 'none';
      }
    });

    socket.on('message:new', (msg) => {
      appendMessage(msg, true);
      scrollToBottom();
      if (msg.sender === 'bot' || msg.sender === 'admin') {
        playIncomingChime();
        triggerHaptic();
      }
    });

    socket.on('messages:read', () => {
      // Update checkmarks to blue
      document.querySelectorAll('.msg-ticks.delivered').forEach(tick => {
        tick.classList.remove('delivered');
        tick.classList.add('read');
      });
    });

    socket.on('typing:status', (data) => {
      if (data.isTyping) {
        statusText.textContent = data.statusText || 'typing...';
        typingStatusLabel.textContent = data.statusText || 'typing...';
        typingIndicator.style.display = 'flex';
        scrollToBottom();
      } else {
        statusText.textContent = settings.brandStatus || 'online';
        typingIndicator.style.display = 'none';
      }
    });

    socket.on('phone:prompt', (data) => {
      const savedPhone = localStorage.getItem('wa_saved_phone');
      if (!savedPhone) {
        if (data.message) {
          const descEl = document.getElementById('phonePromptDesc');
          if (descEl) descEl.textContent = data.message;
        }
        phonePromptCard.style.display = 'block';
      }
    });

    socket.on('quick_replies:update', (replies) => {
      renderQuickReplies(replies);
    });

    socket.on('conversation:cleared', () => {
      chatFeed.innerHTML = `
        <div class="date-divider">
          <span>TODAY</span>
        </div>
      `;
    });
  }

  // --- Apply Settings ---
  function applySettings(s) {
    if (s.brandName) headerAgentName.textContent = s.brandName;
    if (s.brandStatus) statusText.textContent = s.brandStatus;
    if (s.brandAvatar) headerAvatar.src = s.brandAvatar;
    if (s.phonePromptMessage) {
      const descEl = document.getElementById('phonePromptDesc');
      if (descEl) descEl.textContent = s.phonePromptMessage;
    }
  }

  // --- Format Time ---
  function formatTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // Format Duration seconds to M:SS
  function formatDuration(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }

  // --- Render Message Bubbles ---
  function appendMessage(msg, animate = true) {
    const isOutgoing = msg.sender === 'visitor';
    const row = document.createElement('div');
    row.className = `msg-row ${isOutgoing ? 'outgoing' : 'incoming'}`;
    if (!animate) row.style.animation = 'none';

    let contentHtml = '';

    // Render based on message type
    if (msg.type === 'voice') {
      const audioId = 'aud_' + Math.random().toString(36).substring(2, 8);
      const durationFormatted = formatDuration(msg.voiceDuration || 14);

      contentHtml = `
        <div class="voice-player" id="${audioId}">
          <div class="voice-avatar-mic">
            <img src="${isOutgoing ? '/assets/default-avatar.svg' : (settings.brandAvatar || '/assets/default-avatar.svg')}" alt="Voice">
            <div class="voice-mic-badge">
              <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
            </div>
          </div>
          <div class="voice-controls">
            <div class="voice-track-row">
              <button class="voice-play-btn" data-audio-id="${audioId}" data-url="${msg.content}">
                <svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <div class="waveform-bars" data-audio-id="${audioId}">
                ${generateWaveformBarsHtml()}
              </div>
            </div>
            <div class="voice-meta-row">
              <span class="voice-timer" id="${audioId}_time">0:00 / ${durationFormatted}</span>
              <button class="speed-pill" data-audio-id="${audioId}">1x</button>
            </div>
          </div>
        </div>
      `;
    } else if (msg.type === 'image') {
      contentHtml = `
        <div class="msg-media-wrap" onclick="window.viewMedia('${msg.content}', 'image')">
          <img class="msg-image" src="${msg.content}" alt="Image" loading="lazy">
        </div>
        ${msg.caption ? `<div class="msg-caption">${escapeHtml(msg.caption)}</div>` : ''}
      `;
    } else if (msg.type === 'video') {
      contentHtml = `
        <div class="msg-media-wrap">
          <video class="msg-video" src="${msg.content}" controls playsinline preload="metadata"></video>
        </div>
        ${msg.caption ? `<div class="msg-caption">${escapeHtml(msg.caption)}</div>` : ''}
      `;
    } else {
      // Standard Text Message (format bold **text** and linebreaks)
      let formattedText = escapeHtml(msg.content);
      formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedText = formattedText.replace(/\n/g, '<br>');
      contentHtml = `<div class="msg-text">${formattedText}</div>`;
    }

    // Tick marks for outgoing
    let ticksHtml = '';
    if (isOutgoing) {
      const isRead = msg.status === 'read';
      ticksHtml = `
        <span class="msg-ticks ${isRead ? 'read' : 'delivered'}">
          <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
          </svg>
        </span>
      `;
    }

    row.innerHTML = `
      <div class="msg-bubble">
        ${contentHtml}
        <div class="msg-meta">
          <span>${formatTime(msg.timestamp)}</span>
          ${ticksHtml}
        </div>
      </div>
    `;

    chatFeed.appendChild(row);

    // Initialize voice player if this was a voice note
    if (msg.type === 'voice') {
      initVoicePlayerListeners(row);
    }
  }

  // Generate 26 visual waveform bars with authentic varied heights
  function generateWaveformBarsHtml() {
    const heights = [35, 60, 45, 80, 100, 70, 50, 90, 85, 40, 65, 95, 75, 45, 85, 90, 55, 70, 40, 75, 90, 60, 50, 40, 65, 30];
    return heights.map((h, i) => `
      <div class="waveform-bar" data-index="${i}" style="height: ${Math.max(4, Math.floor(h * 0.22))}px;"></div>
    `).join('');
  }

  // --- Voice Note Audio Player Controller ---
  function initVoicePlayerListeners(container) {
    const playBtn = container.querySelector('.voice-play-btn');
    const speedBtn = container.querySelector('.speed-pill');
    const waveform = container.querySelector('.waveform-bars');
    const timerEl = container.querySelector('.voice-timer');

    if (!playBtn) return;
    const audioId = playBtn.dataset.audioId;
    const audioUrl = playBtn.dataset.url;

    const audio = new Audio(audioUrl);
    const bars = waveform.querySelectorAll('.waveform-bar');
    const speeds = [1, 1.5, 2];
    let currentSpeedIdx = 0;

    currentAudios.set(audioId, { audio, bars, timerEl, playBtn });

    // Play/Pause Click
    playBtn.addEventListener('click', () => {
      // Pause any other playing audio
      currentAudios.forEach((item, id) => {
        if (id !== audioId && !item.audio.paused) {
          item.audio.pause();
          item.playBtn.innerHTML = `<svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        }
      });

      if (audio.paused) {
        audio.play().then(() => {
          playBtn.innerHTML = `<svg class="pause-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        }).catch(e => console.log('Playback error:', e));
      } else {
        audio.pause();
        playBtn.innerHTML = `<svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
      }
    });

    // Speed toggle (1x -> 1.5x -> 2x)
    if (speedBtn) {
      speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
        const spd = speeds[currentSpeedIdx];
        audio.playbackRate = spd;
        speedBtn.textContent = spd + 'x';
      });
    }

    // Time update listener
    audio.addEventListener('timeupdate', () => {
      const dur = audio.duration || 1;
      const cur = audio.currentTime;
      timerEl.textContent = `${formatDuration(cur)} / ${formatDuration(dur)}`;

      const progress = cur / dur;
      const activeBarCount = Math.floor(progress * bars.length);
      bars.forEach((bar, idx) => {
        if (idx <= activeBarCount) {
          bar.classList.add('played');
        } else {
          bar.classList.remove('played');
        }
      });
    });

    // On ended
    audio.addEventListener('ended', () => {
      playBtn.innerHTML = `<svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
      bars.forEach(b => b.classList.remove('played'));
      timerEl.textContent = `0:00 / ${formatDuration(audio.duration)}`;
    });

    // Seeking by clicking on waveform
    waveform.addEventListener('click', (e) => {
      const rect = waveform.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      if (audio.duration) {
        audio.currentTime = pct * audio.duration;
      }
    });
  }

  // --- Render Quick Reply Chips ---
  function renderQuickReplies(replies) {
    quickRepliesBar.innerHTML = '';
    if (!replies || replies.length === 0) {
      quickRepliesBar.style.display = 'none';
      return;
    }

    quickRepliesBar.style.display = 'flex';
    replies.forEach(qr => {
      const chip = document.createElement('button');
      chip.className = 'quick-chip';
      chip.textContent = qr.label;
      chip.addEventListener('click', () => {
        sendVisitorMessage(qr.label);
      });
      quickRepliesBar.appendChild(chip);
    });
  }

  // --- Send Message ---
  function sendVisitorMessage(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // Check if phone number is in message and store locally
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,13}\b/;
    if (phoneRegex.test(cleanText)) {
      phonePromptCard.style.display = 'none';
      localStorage.setItem('wa_saved_phone', cleanText);
    }

    playOutgoingPop();

    socket.emit('visitor:message', {
      visitorId: visitorId,
      text: cleanText,
      type: 'text'
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
  }

  // --- Auto Resize Textarea & Handle Enter ---
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 90) + 'px';
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendVisitorMessage(messageInput.value);
    }
  });

  sendBtn.addEventListener('click', () => {
    sendVisitorMessage(messageInput.value);
  });

  // --- File / Attachment Picker ---
  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        const isVideo = file.type.startsWith('video');
        socket.emit('visitor:message', {
          visitorId: visitorId,
          type: isVideo ? 'video' : 'image',
          content: data.url,
          caption: ''
        });
      }
    } catch (err) {
      console.error('File upload error:', err);
    }
    fileInput.value = '';
  });

  // --- Visitor In-Browser Voice Note Recorder ---
  if (visitorMicBtn) {
    visitorMicBtn.addEventListener('click', async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Microphone access is not supported by your browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        visitorAudioChunks = [];
        visitorMediaRecorder = new MediaRecorder(stream);

        visitorMediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) visitorAudioChunks.push(e.data);
        };

        visitorMediaRecorder.onstop = () => {
          clearInterval(visitorRecordInterval);
          const tracks = stream.getTracks();
          tracks.forEach(t => t.stop());
        };

        visitorMediaRecorder.start();
        visitorRecordStartTime = Date.now();
        if (visitorVoiceBar) visitorVoiceBar.style.display = 'flex';

        visitorRecordInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - visitorRecordStartTime) / 1000);
          const m = Math.floor(elapsed / 60);
          const s = elapsed % 60;
          if (visitorRecordTimer) {
            visitorRecordTimer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
          }
        }, 500);

      } catch (err) {
        alert('Microphone permission required to send voice notes: ' + err.message);
      }
    });
  }

  if (cancelVisitorRecordBtn) {
    cancelVisitorRecordBtn.addEventListener('click', () => {
      if (visitorMediaRecorder && visitorMediaRecorder.state !== 'inactive') {
        visitorMediaRecorder.stop();
      }
      clearInterval(visitorRecordInterval);
      if (visitorVoiceBar) visitorVoiceBar.style.display = 'none';
      visitorAudioChunks = [];
    });
  }

  if (sendVisitorRecordBtn) {
    sendVisitorRecordBtn.addEventListener('click', () => {
      if (!visitorMediaRecorder || visitorMediaRecorder.state === 'inactive') return;
      const durationSec = Math.max(1, Math.floor((Date.now() - visitorRecordStartTime) / 1000));

      visitorMediaRecorder.onstop = async () => {
        clearInterval(visitorRecordInterval);
        if (visitorVoiceBar) visitorVoiceBar.style.display = 'none';

        const audioBlob = new Blob(visitorAudioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'visitor-voice.webm');

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.url) {
            playOutgoingPop();
            socket.emit('visitor:message', {
              visitorId: visitorId,
              type: 'voice',
              content: data.url,
              voiceDuration: durationSec
            });
          }
        } catch (err) {
          console.error('Voice upload error:', err);
        }
      };

      visitorMediaRecorder.stop();
    });
  }

  // --- Phone Prompt Submit ---
  phonePromptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = promptPhoneInput.value.trim();
    if (!phone) return;

    localStorage.setItem('wa_saved_phone', phone);
    phonePromptCard.style.display = 'none';

    socket.emit('visitor:save_phone', {
      visitorId: visitorId,
      phone: phone
    });
  });

  closePhonePrompt.addEventListener('click', () => {
    phonePromptCard.style.display = 'none';
  });

  // --- Lightbox Media Viewer ---
  window.viewMedia = function (url, type) {
    if (type === 'image') {
      lightboxBody.innerHTML = `<img src="${url}" alt="Preview">`;
    } else if (type === 'video') {
      lightboxBody.innerHTML = `<video src="${url}" controls autoplay></video>`;
    }
    mediaLightbox.style.display = 'flex';
  };

  closeLightbox.addEventListener('click', () => {
    mediaLightbox.style.display = 'none';
    lightboxBody.innerHTML = '';
  });

  mediaLightbox.addEventListener('click', (e) => {
    if (e.target === mediaLightbox) {
      mediaLightbox.style.display = 'none';
      lightboxBody.innerHTML = '';
    }
  });

  // --- Auto Scroll ---
  function scrollToBottom() {
    setTimeout(() => {
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }, 40);
  }

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Haptic Feedback for Mobile ---
  function triggerHaptic() {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([35, 45, 35]);
      }
    } catch (e) {}
  }

  // --- Progressive Web App (PWA) Install Logic ---
  let deferredPrompt = null;
  const pwaInstallBanner = document.getElementById('pwaInstallBanner');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  const pwaDismissBtn = document.getElementById('pwaDismissBtn');

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('✓ WhatsApp Business PWA Service Worker Registered', reg.scope);
      }).catch((err) => {
        console.log('Service Worker registration note:', err);
      });
    });
  }

  // Detect Android/Chrome native install trigger
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem('wa_pwa_dismissed')) {
      if (pwaInstallBanner) pwaInstallBanner.style.display = 'flex';
    }
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install prompt outcome: ${outcome}`);
        deferredPrompt = null;
        if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      } else {
        // Fallback instructions for iOS or desktop
        alert('📲 To install WhatsApp Business on your phone:\n\n• On iPhone (Safari): Tap the Share button (⎋) at the bottom, then tap "Add to Home Screen" (⊞)\n• On Android (Chrome): Tap the top 3 dots (⋮) and tap "Install app" or "Add to Home Screen"');
        if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      }
    });
  }

  if (pwaDismissBtn) {
    pwaDismissBtn.addEventListener('click', () => {
      if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      sessionStorage.setItem('wa_pwa_dismissed', '1');
    });
  }

  // Check if running on iOS Safari outside standalone mode
  const isIosDevice = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone = () => ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;

  if (isIosDevice() && !isStandalone() && !sessionStorage.getItem('wa_pwa_dismissed')) {
    if (pwaInstallBanner) pwaInstallBanner.style.display = 'flex';
  }

  // Start connection
  connectSocket();

})();
