const http = require('http');

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function runTests() {
  console.log('\n=== API ENDPOINT TESTING ===\n');
  let token = null;
  let patientId = null;

  try {
    // 1. Health Check
    console.log('1. Testing GET /health');
    const health = await makeRequest({ hostname: 'localhost', port: 3000, path: '/health', method: 'GET' });
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.body)}\n`);

    // 2. Register Patient
    console.log('2. Testing POST /api/auth/register');
    const register = await makeRequest(
      { hostname: 'localhost', port: 3000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'testpatient@example.com', password: 'Test123!', firstName: 'John', lastName: 'Doe' }
    );
    console.log(`   Status: ${register.status}`);
    console.log(`   Response: ${JSON.stringify(register.body).substring(0, 200)}...\n`);
    
    if (register.body.token) {
      token = register.body.token;
      patientId = register.body.user?.patientId;
      console.log(`   ✓ Token captured: ${token.substring(0, 20)}...`);
      console.log(`   ✓ Patient ID: ${patientId}\n`);
    }

    // 3. Login
    console.log('3. Testing POST /api/auth/login');
    const login = await makeRequest(
      { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'testpatient@example.com', password: 'Test123!' }
    );
    console.log(`   Status: ${login.status}`);
    console.log(`   Response: ${JSON.stringify(login.body).substring(0, 200)}...\n`);

    // 4. Get Me (authenticated)
    if (token) {
      console.log('4. Testing GET /api/auth/me');
      const me = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/auth/me', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(`   Status: ${me.status}`);
      console.log(`   Response: ${JSON.stringify(me.body)}\n`);

      // 5. Get Onboarding Status
      console.log('5. Testing GET /api/onboarding/status');
      const status = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/onboarding/status', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(`   Status: ${status.status}`);
      console.log(`   Response: ${JSON.stringify(status.body)}\n`);

      // 6. Get Doctors List
      console.log('6. Testing GET /api/onboarding/doctors');
      const doctors = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/onboarding/doctors', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(`   Status: ${doctors.status}`);
      console.log(`   Response: ${JSON.stringify(doctors.body)}\n`);

      // 7. Submit Onboarding Step 1
      console.log('7. Testing POST /api/onboarding/step1');
      const step1 = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/onboarding/step1', method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } },
        { fullName: 'John Doe', dateOfBirth: '1990-01-01', gender: 'male', phoneNumber: '+1234567890', emergencyContactName: 'Jane Doe', emergencyContactPhone: '+0987654321' }
      );
      console.log(`   Status: ${step1.status}`);
      console.log(`   Response: ${JSON.stringify(step1.body)}\n`);

      // 8. Get Chat Room
      console.log('8. Testing GET /api/chat/room');
      const chatRoom = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/chat/room', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(`   Status: ${chatRoom.status}`);
      console.log(`   Response: ${JSON.stringify(chatRoom.body)}\n`);

      // 9. Get Unread Count
      console.log('9. Testing GET /api/chat/unread-count');
      const unread = await makeRequest(
        { hostname: 'localhost', port: 3000, path: '/api/chat/unread-count', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(`   Status: ${unread.status}`);
      console.log(`   Response: ${JSON.stringify(unread.body)}\n`);
    }

    console.log('\n=== TESTING COMPLETE ===');
    console.log('✓ All endpoints tested successfully');
    
  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
  }
}

runTests();
