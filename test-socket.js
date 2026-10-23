/**
 * Socket.IO Connection Test Script
 * Run this in Node.js to test socket connection
 * 
 * Usage: 
 *   node test-socket.js
 *   OR
 *   npm install socket.io-client (if not installed)
 *   node test-socket.js
 * 
 * Make sure socket.io-client is installed:
 *   npm install socket.io-client
 */

// Check if socket.io-client is available
let io;
try {
  io = require('socket.io-client');
} catch (error) {
  console.error('❌ socket.io-client is not installed!');
  console.error('   Install it with: npm install socket.io-client');
  process.exit(1);
}

// Configuration - Change these if needed
const SOCKET_URL = process.env.SOCKET_URL || 'https://portal.logistiqinnovations.ca';
const SOCKET_PATH = process.env.SOCKET_PATH || '/socket.io/';

console.log('🧪 Socket.IO Connection Test');
console.log('='.repeat(50));
console.log(`📍 URL: ${SOCKET_URL}`);
console.log(`📍 Path: ${SOCKET_PATH}`);
console.log(`📍 Time: ${new Date().toLocaleString()}`);
console.log('='.repeat(50));
console.log('');

const socket = io(SOCKET_URL, {
  path: SOCKET_PATH,
  transports: ['polling', 'websocket'],
  reconnection: true,
  timeout: 10000,
  query: {
    platform: 'test-script'
  }
});

// Connection events
socket.on('connect', () => {
  const connectTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('✅ Socket Connected Successfully!');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.io.engine.transport.name}`);
  console.log(`   Connection Time: ${connectTime}s`);
  console.log('');
  
  // Test joining a vehicle room (if needed)
  // socket.emit('joinVehicle', 'test-vehicle-id');
  
  // Close after successful test
  setTimeout(() => {
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(50));
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection Error:');
  console.error(`   Message: ${error.message}`);
  console.error(`   Type: ${error.type}`);
  console.error(`   Description: ${error.description || 'N/A'}`);
  console.error('');
  console.error('🔍 Troubleshooting:');
  console.error('   1. Check if backend server is running');
  console.error('   2. Verify nginx configuration');
  console.error('   3. Check firewall/security groups');
  console.error('   4. Test endpoint: curl https://portal.logistiqinnovations.ca/socket.io/');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️ Disconnected:');
  console.warn(`   Reason: ${reason}`);
});

socket.on('error', (error) => {
  console.error('❌ Socket Error:', error);
});

// Timeout handler
setTimeout(() => {
  if (!socket.connected) {
    console.error('❌ Connection timeout after 10 seconds');
    console.error('   Socket failed to connect');
    socket.disconnect();
    process.exit(1);
  }
}, 10000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted');
  socket.disconnect();
  process.exit(0);
});

