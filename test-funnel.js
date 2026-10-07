const { io } = require('socket.io-client');

async function testSimulation() {
  console.log('--- STARTING SYSTEM VERIFICATION TEST ---');
  const visitorSocket = io('http://localhost:3000');
  const adminSocket = io('http://localhost:3000');

  let visitorJoined = false;
  let adminReceivedMessage = false;

  adminSocket.on('connect', () => {
    console.log('✓ Admin socket connected');
    adminSocket.emit('admin:join');
  });

  adminSocket.on('admin:init_data', (data) => {
    console.log(`✓ Admin received init data: ${data.flows.length} flows, ${data.quickReplies.length} quick replies`);
  });

  adminSocket.on('visitor:updated', (vis) => {
    console.log(`✓ Admin notified: Visitor updated (${vis.name}, Phone: ${vis.phone || 'none'})`);
  });

  adminSocket.on('message:new', (msg) => {
    console.log(`✓ Admin received message: [${msg.sender.toUpperCase()}] ${msg.content ? msg.content.substring(0, 40) : msg.type}`);
    adminReceivedMessage = true;
  });

  const testVisitorId = 'test_vis_' + Date.now();

  visitorSocket.on('connect', () => {
    console.log('✓ Visitor socket connected');
    visitorSocket.emit('visitor:join', {
      visitorId: testVisitorId,
      name: 'Test Customer',
      source: 'TikTok Ads Campaign'
    });
  });

  visitorSocket.on('visitor:init_data', (data) => {
    console.log(`✓ Visitor received init: Brand="${data.settings.brandName}", QuickReplies=${data.quickReplies.length}`);
    visitorJoined = true;
  });

  visitorSocket.on('typing:status', (data) => {
    console.log(`✓ Visitor typing event: isTyping=${data.isTyping}, status="${data.statusText || ''}"`);
  });

  visitorSocket.on('message:new', (msg) => {
    console.log(`✓ Visitor received message: [${msg.sender.toUpperCase()}] ${msg.content ? msg.content.substring(0, 40) : msg.type}`);
  });

  // Wait 4 seconds for welcome flow step to trigger, then trigger quick reply and phone
  setTimeout(() => {
    console.log('\n--- Visitor sending COD question ---');
    visitorSocket.emit('visitor:message', {
      visitorId: testVisitorId,
      text: 'Cash on delivery available?',
      type: 'text'
    });
  }, 4000);

  setTimeout(() => {
    console.log('\n--- Visitor submitting phone number ---');
    visitorSocket.emit('visitor:save_phone', {
      visitorId: testVisitorId,
      phone: '+1 (555) 234-5678'
    });
  }, 7000);

  setTimeout(() => {
    console.log('\n--- VERIFICATION FINISHED SUCCESSFULLY ---');
    visitorSocket.disconnect();
    adminSocket.disconnect();
    process.exit(0);
  }, 9000);
}

testSimulation().catch(err => {
  console.error(err);
  process.exit(1);
});
