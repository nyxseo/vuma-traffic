/**
 * Vuma Desktop — QA Test from User Perspective
 * 
 * Tests the complete user flow:
 *   Login → Dashboard → Stats → Traffic Control → Logs → Settings → Admin → Logout
 */
const api = require('./main/api');
const cli = require('./main/cli');

let passed = 0;
let failed = 0;
const errors = [];

async function assert(desc, condition, detail = '') {
  if (await Promise.resolve(condition)) {
    passed++;
    console.log(`  ✅ ${desc}`);
  } else {
    failed++;
    const msg = `  ❌ ${desc}${detail ? ' — ' + detail : ''}`;
    console.log(msg);
    errors.push({ desc, error: detail });
  }
}

async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   VUMA DESKTOP — USER FLOW QA TEST      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // ──── 1. AUTH FLOW ────
  console.log('─── 1. AUTH / LOGIN ───');
  
  // 1a. Login success
  let loginRes;
  try {
    loginRes = await api.login('admin@vuma.id', 'admin123');
    await assert('Login returns user object', !!loginRes.user);
    await assert('Login returns plan object', !!loginRes.plan);
    await assert('Login returns token', !!loginRes.token);
    await assert('Login user has name', loginRes.user.name === 'Super Admin');
    await assert('Login user has enterprise plan', loginRes.user.plan === 'Enterprise');
    await assert('Login plan has name', loginRes.plan.name === 'Enterprise');
    await assert('Login plan has trafficLimitDaily', loginRes.plan.trafficLimitDaily > 0);
    await assert('Login plan has isProxyEnabled', typeof loginRes.plan.isProxyEnabled === 'boolean');
    await assert('Login has refreshToken', !!loginRes.refreshToken);
  } catch(e) {
    await assert('Login works', false, e.message);
  }

  // 1b. Wrong password
  try {
    await api.login('admin@vuma.id', 'wrongpassword');
    await assert('Wrong password rejects', false, 'Should have thrown error');
  } catch(e) {
    const msg = e.response?.data?.error || e.message;
    await assert('Wrong password returns proper error', msg.includes('Invalid') || msg.includes('salah'), msg);
  }

  // 1c. /me endpoint
  try {
    const me = await api.getMe();
    await assert('/me returns user', !!me.user);
    await assert('/me returns plan', !!me.plan);
    await assert('/me user has email', me.user.email === 'admin@vuma.id');
    await assert('/me user role is admin', me.user.role === 'admin');
    await assert('/me plan has features', typeof me.plan.isProxyEnabled === 'boolean');
  } catch(e) {
    await assert('/me works', false, e.message);
  }

  // ──── 2. DASHBOARD & STATS ────
  console.log('');
  console.log('─── 2. DASHBOARD / STATS ───');

  try {
    const stats = await api.getStats();
    await assert('Stats returns data', !!stats);
    const statsData = stats.stats || stats;
    await assert('Stats has totalHitsToday', typeof statsData.totalHitsToday !== 'undefined');
    await assert('Stats has totalHitsAll', typeof statsData.totalHitsAll !== 'undefined');
    await assert('Stats has dataUsedToday', typeof statsData.dataUsedToday !== 'undefined');
    await assert('Stats has limits', !!stats.limits);
    await assert('Stats.limits has threadLimit', stats.limits.threadLimit > 0);
    await assert('Stats.limits has fingerprintLimit', stats.limits.fingerprintLimit > 0);
    await assert('Stats.limits has trafficLimitDaily', stats.limits.trafficLimitDaily > 0);
  } catch(e) {
    await assert('Stats works', false, e.message);
  }

  // ──── 3. FINGERPRINTS ────
  console.log('');
  console.log('─── 3. FINGERPRINTS ───');

  try {
    const fps = await api.listFingerprints();
    await assert('List fingerprints returns data', !!fps);
    await assert('List fingerprints has array', Array.isArray(fps.fingerprints));
    await assert('List fingerprints has usage info', !!fps.usage);

    // Create a test fingerprint
    const fp = await api.createFingerprint('qa-test-fp-' + Date.now(), 'desktop', 'windows', 'chrome');
    await assert('Create fingerprint returns verified', fp.verified === true);
    await assert('Create fingerprint returns id', !!fp.fingerprint?.id);
    await assert('Create fingerprint returns usage', !!fp.usage);
    await assert('Create fingerprint usage has current+limit', typeof fp.usage.current === 'number' && typeof fp.usage.limit === 'number');
  } catch(e) {
    await assert('Fingerprint test', false, e.response?.data?.error || e.message);
  }

  // ──── 4. TRAFFIC SOURCES ────
  console.log('');
  console.log('─── 4. TRAFFIC SOURCES ───');

  try {
    const sources = await api.getTrafficSources(10);
    await assert('Traffic sources returns sources', Array.isArray(sources.sources) && sources.sources.length > 0);
    await assert('Traffic sources has plan name', !!sources.plan);
    await assert('Traffic sources has limits', !!sources.limits);
    await assert('Traffic sources limit has isUnlimited', typeof sources.limits.isUnlimited === 'boolean');
    await assert('Traffic sources limit has trafficRemaining', typeof sources.limits.trafficRemaining === 'number');
    
    // Source entry format
    const s = sources.sources[0];
    await assert('Source has url', !!s.url);
    await assert('Source has name', !!s.name);
    await assert('Source has category', !!s.category);
  } catch(e) {
    await assert('Traffic sources works', false, e.message);
  }

  // ──── 5. CLI MANAGER ────
  console.log('');
  console.log('─── 5. CLI MANAGER ───');

  const status = cli.getStatus();
  await assert('CLI reports running=false', status.running === false);
  await assert('CLI has command path', !!status.command);
  await assert('CLI path exists', require('fs').existsSync(cli.jtPath), 'Path: ' + cli.jtPath);

  const stopRes = cli.stop();
  await assert('CLI stop when idle returns error', stopRes.error === 'Not running');

  // ──── 6. ADMIN PANEL ────
  console.log('');
  console.log('─── 6. ADMIN PANEL ───');

  try {
    const adminStats = await api.adminGetStats();
    await assert('Admin stats has users', typeof adminStats.users === 'object');
    await assert('Admin stats has transactions', typeof adminStats.transactions === 'object');
    await assert('Admin stats has planDistribution', Array.isArray(adminStats.planDistribution));
    await assert('Admin stats has recentLogs', Array.isArray(adminStats.recentLogs));
    await assert('Admin stats users has total', typeof adminStats.users.total === 'number');
    await assert('Admin stats has totalRevenue', typeof adminStats.transactions.totalRevenue === 'number');

    const plans = await api.adminGetPlans();
    await assert('Admin plans is array', Array.isArray(plans.plans));
    await assert('Admin plans >= 4', plans.plans.length >= 4);
    
    const planNames = plans.plans.map(p => p.name);
    await assert('Admin has Free plan', planNames.includes('Free'));
    await assert('Admin has Starter plan', planNames.includes('Starter'));
    await assert('Admin has Pro plan', planNames.includes('Pro'));
    await assert('Admin has Enterprise plan', planNames.includes('Enterprise'));

    const users = await api.adminGetUsers({ limit: 10 });
    await assert('Admin users returns pagination', !!users.pagination);
    await assert('Admin users pagination has total', typeof users.pagination.total === 'number');
  } catch(e) {
    await assert('Admin panel works', false, e.message);
  }

  // ──── 7. REGISTRATION (NEW USER) ────
  console.log('');
  console.log('─── 7. NEW USER REGISTRATION ───');
  
  const testEmail = 'qa-test-' + Date.now() + '@test.com';

  try {
    const reg = await api.register('QA User', testEmail, 'qatest123');
    await assert('Register returns user', !!reg.user);
    await assert('Register returns plan Free', reg.user.plan === 'Free');
    await assert('Register returns token', !!reg.token);
    
    // Login as new user
    const loginNew = await api.login(testEmail, 'qatest123');
    await assert('New user login works', !!loginNew.user);
    await assert('New user login shows Free plan', loginNew.user.plan === 'Free');
    await assert('New user plan trafficLimitDaily=500', loginNew.plan.trafficLimitDaily === 500);
    await assert('New user plan isProxyEnabled=false', loginNew.plan.isProxyEnabled === false);
    await assert('New user plan isVerifiedFingerprint=false', loginNew.plan.isVerifiedFingerprint === false);
  } catch(e) {
    await assert('Registration works', false, e.message);
  }

  // ──── 8. PRELOAD BRIDGE VERIFICATION ────
  console.log('');
  console.log('─── 8. PRELOAD BRIDGE ───');

  const preload = require('fs').readFileSync('./main/preload.js', 'utf-8');
  const channels = preload.match(/ipcRenderer\.invoke\('([^']+)'/g) || [];
  const channelNames = channels.map(c => c.match(/'([^']+)'/)[1]);
  
  console.log(`  📋 ${channelNames.length} IPC channels defined`);

  // Verify each channel has a handler in main.js
  const mainSrc = require('fs').readFileSync('./main/main.js', 'utf-8');
  let missingChannels = [];
  for (const ch of channelNames) {
    if (!mainSrc.includes(`'${ch}'`)) {
      missingChannels.push(ch);
    }
  }

  await assert('All IPC channels have handlers', missingChannels.length === 0,
    missingChannels.length > 0 ? 'Missing: ' + missingChannels.join(', ') : '');

  // ──── SUMMARY ────
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log(`  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('');
    console.log('  FAILURES:');
    errors.forEach(e => console.log(`    ❌ ${e.desc}: ${e.error}`));
  }
  console.log('══════════════════════════════════════════');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('QA crashed:', e.message);
  process.exit(1);
});
