const http = require('http');

function api(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'localhost', port: 3080, path, method,
      headers: { 'Content-Type': 'application/json' },
      agent: false, timeout: 20000
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== CREATE USER TEST ===\n');

  // 1. Login
  console.log('[1] Login admin...');
  const login = await api('POST', '/api/auth/login', { email: 'admin@vuma.id', password: 'admin123' });
  if (login.status !== 200) { console.log('  ❌ Login failed:', login.status); process.exit(1); }
  const token = login.data.token;
  console.log('  ✅ Login OK');

  // 2. Count users before
  console.log('[2] Count users before...');
  const before = await api('GET', '/api/admin/users', null, token);
  const countBefore = before.data?.pagination?.total || 0;
  console.log('  Total users before:', countBefore);

  // 3. Create user
  console.log('[3] Creating user test@createuser.com...');
  const create = await api('POST', '/api/admin/users', {
    name: 'Create Test',
    email: 'test@createuser.com',
    password: 'test123',
    planId: 'starter'
  }, token);
  console.log('  Create response:', create.status, JSON.stringify(create.data));

  // 4. Count users after
  console.log('[4] Count users after...');
  const after = await api('GET', '/api/admin/users', null, token);
  const countAfter = after.data?.pagination?.total || 0;
  console.log('  Total users after:', countAfter);

  if (countAfter > countBefore) {
    console.log('\n  ✅ User successfully created!');
  } else {
    console.log('\n  ❌ User count did not increase!');
  }

  // 5. Try login as new user
  console.log('[5] Testing login as new user...');
  const userLogin = await api('POST', '/api/auth/login', { email: 'test@createuser.com', password: 'test123' });
  if (userLogin.status === 200) {
    console.log('  ✅ New user can login! Plan:', userLogin.data.user?.plan);
  } else {
    console.log('  ❌ Login failed:', userLogin.status, JSON.stringify(userLogin.data));
  }
}

main().catch(e => console.error('FATAL:', e.message));
