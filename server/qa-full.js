#!/usr/bin/env node
// Vuma Traffic - Comprehensive QA Test Script
const http = require('http');
const fs = require('fs');

const PASS = 0;
const FAIL = 0;
let pass = 0, fail = 0;

function req(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'localhost', port: 3080, path, method,
      headers: { 'Content-Type': 'application/json' },
      agent: false, timeout: 15000,
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const start = Date.now();
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), 15000);
    const r = http.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        clearTimeout(timer);
        try { resolve({ status: res.statusCode, data: JSON.parse(b), elapsed: Date.now() - start }); }
        catch { resolve({ status: res.statusCode, data: b, elapsed: Date.now() - start }); }
      });
    });
    r.on('error', e => { clearTimeout(timer); reject(e); });
    if (payload) r.write(payload);
    r.end();
  });
}

function check(desc, ok) {
  if (ok) { console.log(`  [PASS] ${desc}`); pass++; }
  else { console.log(`  [FAIL] ${desc}`); fail++; }
}

function urlGet(path) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), 10000);
    http.get(`http://localhost:3080${path}`, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body: b }); });
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

async function main() {
  console.log('=== VUMA TRAFFIC COMPREHENSIVE QA TEST ===\n');

  // ── 1. Health Check ──
  console.log('--- [1] Server Health ---');
  const health = await req('GET', '/api/health');
  check('Server returns healthy', health.data?.status === 'ok');

  // ── 2. Auth: Register ──
  console.log('\n--- [2] User Registration ---');
  const ts = Date.now();
  const regEmail = `qauser${ts}@test.com`;
  let regResp = await req('POST', '/api/auth/register', { name: 'QA User', email: regEmail, password: 'test123' });
  check('Register returns 201', regResp.status === 201);
  check('Register returns token', !!regResp.data?.token);
  check('Register assigns Free plan', regResp.data?.plan?.name === 'Free');
  const userToken = regResp.data?.token;

  // Register with existing email
  let regDup = await req('POST', '/api/auth/register', { name: 'Dup', email: regEmail, password: 'test123' });
  check('Duplicate email returns 409', regDup.status === 409);

  // Register with short password
  let regShort = await req('POST', '/api/auth/register', { name: 'X', email: `short${ts}@t.com`, password: '123' });
  check('Short password returns 400', regShort.status === 400);

  // ── 3. Auth: Login ──
  console.log('\n--- [3] User Login ---');
  let loginOK = await req('POST', '/api/auth/login', { email: regEmail, password: 'test123' });
  check('Valid login returns token', !!loginOK.data?.token);
  check('Login returns user name', loginOK.data?.user?.name === 'QA User');
  check('Login returns plan', loginOK.data?.plan?.name === 'Free');

  let loginBad = await req('POST', '/api/auth/login', { email: regEmail, password: 'wrong' });
  check('Wrong password returns 401', loginBad.status === 401);

  let login404 = await req('POST', '/api/auth/login', { email: 'nobody@test.com', password: 'test123' });
  check('Non-existent email returns 401', login404.status === 401);

  // ── 4. Auth: Refresh Token ──
  console.log('\n--- [4] Token Refresh ---');
  const refreshData = await req('POST', '/api/auth/refresh', { refreshToken: regResp.data?.refreshToken });
  check('Refresh returns new token', !!refreshData.data?.token);

  let refreshBad = await req('POST', '/api/auth/refresh', { refreshToken: 'invalid' });
  check('Invalid refresh token returns 401', refreshBad.status === 401);

  // ── 5. Auth: Get Me ──
  console.log('\n--- [5] Get Me ---');
  const me = await req('GET', '/api/auth/me', null, userToken);
  check('GET /me returns 200', me.status === 200);
  check('GET /me returns user email', me.data?.user?.email === regEmail);
  check('GET /me returns plan object', me.data?.plan?.name === 'Free');

  let meUnauth = await req('GET', '/api/auth/me', null);
  check('GET /me without token returns 401', meUnauth.status === 401);

  // ── 6. Stats ──
  console.log('\n--- [6] Stats ---');
  const stats = await req('GET', '/api/stats', null, userToken);
  check('GET /stats returns 200', stats.status === 200);
  check('Stats has totalHitsToday', 'totalHitsToday' in (stats.data?.stats || {}));
  check('Stats has limits', 'trafficLimitDaily' in (stats.data?.limits || {}));

  // ── 7. Fingerprints ──
  console.log('\n--- [7] Fingerprints ---');
  const fpList = await req('GET', '/api/fingerprint/list', null, userToken);
  check('GET /fingerprint/list returns 200', fpList.status === 200);

  // ── 8. Traffic Source ──
  console.log('\n--- [8] Traffic Source ---');
  const tsResp = await req('POST', '/api/traffic-source', { limit: 5 }, userToken);
  check('POST /traffic-source returns 200', tsResp.status === 200);
  check('Traffic source returns sources array', Array.isArray(tsResp.data?.sources));
  check('Traffic source returns limits', !!tsResp.data?.limits);

  // ── 9. Admin: Stats ──
  console.log('\n--- [9] Admin Stats ---');
  const adminStats = await req('GET', '/api/admin/stats', null, loginOK.data?.token);
  check('Admin stats returns users count', typeof adminStats.data?.users?.total === 'number');
  check('Admin stats returns revenue', typeof adminStats.data?.transactions?.totalRevenue === 'number');

  // ── 10. Admin: Users ──
  console.log('\n--- [10] Admin Users CRUD ---');
  const usersList = await req('GET', '/api/admin/users', null, loginOK.data?.token);
  check('Admin lists users', usersList.status === 200);
  check('Users list has pagination', !!usersList.data?.pagination);

  // Create user via admin
  const adminUser = await req('POST', '/api/admin/users', { name: 'Admin Created', email: `admincreated${ts}@t.com`, password: 'test123', planId: 'starter' }, loginOK.data?.token);
  check('Admin creates user', adminUser.status === 201);

  // Change plan
  if (adminUser.data?.user?.id) {
    const planChange = await req('PUT', `/api/admin/users/${adminUser.data.user.id}/plan`, { planId: 'pro' }, loginOK.data?.token);
    check('Admin changes plan', planChange.status === 200);
  }

  // ── 11. Admin: Plans ──
  console.log('\n--- [11] Admin Plans ---');
  const plans = await req('GET', '/api/admin/plans', null, loginOK.data?.token);
  check('Admin lists plans', plans.status === 200);
  check('Plans has Free', plans.data?.plans?.some(p => p.name === 'Free'));
  check('Plans has Starter', plans.data?.plans?.some(p => p.name === 'Starter'));
  check('Plans has Pro', plans.data?.plans?.some(p => p.name === 'Pro'));
  check('Plans has Enterprise', plans.data?.plans?.some(p => p.name === 'Enterprise'));

  // ── 12. Admin: Transactions ──
  console.log('\n--- [12] Admin Transactions ---');
  const tx = await req('GET', '/api/admin/transactions', null, loginOK.data?.token);
  check('Admin lists transactions', tx.status === 200);
  check('Transactions has list', !!tx.data?.transactions);

  // ── 13. Public Pages ──
  console.log('\n--- [13] Public Pages ---');
  const landing = await urlGet('/');
  check('Landing page renders', landing.status === 200 && landing.body.includes('Vuma'));

  const pricing = await urlGet('/pricing');
  check('Pricing page renders', pricing.status === 200 && pricing.body.includes('Pricing'));

  const registerPage = await urlGet('/register');
  check('Register page renders', registerPage.status === 200 && registerPage.body.includes('Create'));

  const loginPage = await urlGet('/login');
  check('Login page renders', loginPage.status === 200 && loginPage.body.includes('Sign in'));

  const sitemap = await urlGet('/sitemap.xml');
  check('Sitemap XML renders', sitemap.status === 200 && sitemap.body.includes('urlset'));

  const robots = await urlGet('/robots.txt');
  check('Robots.txt renders', robots.status === 200 && robots.body.includes('User-agent'));

  // ── 14. Dashboard User Page ──
  console.log('\n--- [14] Dashboard User ---');
  const dashNoAuth = await urlGet('/dashboard');
  check('Dashboard without auth redirects', dashNoAuth.status === 302 || dashNoAuth.body.includes('login'));

  // ── 15. 404 Page ──
  console.log('\n--- [15] Error Handling ---');
  const notFound = await urlGet('/nonexistent-page-xyz');
  check('Unknown path returns 404', notFound.status === 404);

  // ── 16. Rate Limit Test ──
  console.log('\n--- [16] Rate Limiting ---');
  const rlResp = await req('POST', '/api/auth/login', { email: 'nobody@test.com', password: 'x' });
  check('Rate limit not hit yet (30 per min)', rlResp.status === 401 || rlResp.status === 200);

  // ── 17. Delete User (cleanup) ──
  console.log('\n--- [17] Admin Delete User ---');
  if (adminUser.data?.user?.id) {
    const del = await req('DELETE', `/api/admin/users/${adminUser.data.user.id}`, null, loginOK.data?.token);
    check('Admin deletes user', del.status === 200);
  }

  // ── RESULTS ──
  console.log('\n' + '='.repeat(50));
  console.log(`  TOTAL: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
  console.log('='.repeat(50));
  if (fail === 0) console.log('  ALL TESTS PASSED');
  else console.log('  ' + fail + ' TEST(S) FAILED');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
