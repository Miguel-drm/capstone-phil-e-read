const http = require('http');
const fs = require('fs');

async function checkSystemStatus() {
  console.log('🔍 Phil-E-Read System Status Check');
  console.log('==================================\n');
  
  // Check frontend configuration
  console.log('📋 Frontend Configuration:');
  try {
    const envContent = fs.readFileSync('frontend/.env.local', 'utf8');
    console.log(envContent);
    
    // Extract backend URL
    const match = envContent.match(/VITE_API_URL=(.+)/);
    if (match) {
      const backendUrl = match[1].trim();
      console.log(`🎯 Frontend configured to use: ${backendUrl}`);
      
      // Test backend connection
      const url = new URL(backendUrl);
      await testBackendConnection(url.port);
    }
  } catch (error) {
    console.log('❌ Could not read frontend configuration');
  }
  
  console.log('\n🔍 Testing common backend ports...');
  const commonPorts = [5000, 5001, 5002, 5003];
  
  for (const port of commonPorts) {
    await testBackendConnection(port);
  }
}

function testBackendConnection(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: parseInt(port),
      path: '/api/teachers/test/profile-image',
      method: 'GET',
      timeout: 2000
    };
    
    const req = http.request(options, (res) => {
      console.log(`✅ Port ${port}: Backend responding (${res.statusCode})`);
      resolve(true);
    });
    
    req.on('error', () => {
      console.log(`❌ Port ${port}: No backend running`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`⏰ Port ${port}: Connection timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

checkSystemStatus().catch(console.error);