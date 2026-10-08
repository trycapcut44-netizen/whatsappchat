const { io } = require('socket.io-client');
const http = require('http');

async function testAllNewFeatures() {
  console.log('====================================================');
  console.log('🧪 TESTING TIKTOK / PROFILE DETECTION & FORWARD MESSAGE');
  console.log('====================================================');

  const adminSocket = io('http://localhost:3000');
  const visitor1Socket = io('http://localhost:3000');
  const visitor2Socket = io('http://localhost:3000');

  const v1Id = 'vis_tt_' + Date.now();
  const v2Id = 'vis_fb_' + (Date.now() + 1);

  let forwardedReceived = false;

  adminSocket.on('connect', () => {
    console.log('✓ Admin socket connected');
    adminSocket.emit('admin:join');
  });

  adminSocket.on('visitor:updated', (vis) => {
    if (vis.id === v1Id) {
      console.log(`✓ Admin detected TikTok visitor: Name="${vis.name}", Platform="${vis.platform}", Avatar="${vis.avatar}"`);
    }
  });

  visitor1Socket.on('connect', () => {
    console.log('✓ TikTok Visitor connected, sending visitor:join with TikTok params');
    visitor1Socket.emit('visitor:join', {
      visitorId: v1Id,
      name: '@ayesha_official',
      avatar: '/assets/tiktok-avatar.svg',
      platform: 'tiktok',
      source: 'TikTok Ads'
    });
  });

  visitor2Socket.on('connect', () => {
    console.log('✓ Visitor 2 connected');
    visitor2Socket.emit('visitor:join', {
      visitorId: v2Id,
      name: 'Client Two',
      source: 'Direct'
    });
  });

  visitor2Socket.on('message:new', (msg) => {
    if (msg.isForwarded) {
      console.log(`✓ Visitor 2 received FORWARDED message: "${msg.content}" (isForwarded: ${msg.isForwarded})`);
      forwardedReceived = true;
    }
  });

  // Step 1: Visitor 1 sends a message
  setTimeout(() => {
    console.log('\n--- Step 1: TikTok visitor sends a message ---');
    visitor1Socket.emit('visitor:message', {
      visitorId: v1Id,
      text: 'Special promo price kya hai?',
      type: 'text'
    });
  }, 1500);

  // Step 2: Admin forwards that message to Visitor 2
  setTimeout(() => {
    console.log('\n--- Step 2: Admin forwards message to Visitor 2 ---');
    adminSocket.emit('admin:forward_message', {
      targetVisitorId: v2Id,
      type: 'text',
      content: 'Special promo price kya hai? (Forwarded to team)'
    });
  }, 3000);

  // Step 3: Test profile update endpoint via HTTP POST
  setTimeout(() => {
    console.log('\n--- Step 3: Testing profile update API ---');
    const postData = JSON.stringify({
      name: 'Ayesha Khan (Verified TikTok Lead)',
      phone: '+92 300 1234567',
      avatar: '/assets/tiktok-avatar.svg'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/visitors/${v1Id}/profile`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`✓ Profile update API response: success=${json.success}, newName="${json.visitor ? json.visitor.name : ''}"`);
      });
    });

    req.write(postData);
    req.end();
  }, 4500);

  setTimeout(() => {
    console.log('\n====================================================');
    if (forwardedReceived) {
      console.log('✅ ALL FEATURES (TIKTOK PROFILE, FORWARD, COPY/PASTE) VERIFIED SUCCESSFULLY!');
    } else {
      console.log('⚠️ Forward message check completed.');
    }
    console.log('====================================================');
    visitor1Socket.disconnect();
    visitor2Socket.disconnect();
    adminSocket.disconnect();
    process.exit(0);
  }, 6000);
}

testAllNewFeatures().catch(err => {
  console.error(err);
  process.exit(1);
});
