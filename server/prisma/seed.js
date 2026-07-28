const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default plans
  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Coba Vuma Traffic secara gratis tanpa ribet',
      priceMonthly: 0,
      priceYearly: 0,
      trafficLimitDaily: 500,
      fingerprintLimit: 5,
      threadLimit: 1,
      isProxyEnabled: false,
      isAdNetworksEnabled: false,
      isBoostRpmEnabled: false,
      isVerifiedFingerprint: false,
      isViewAds: false,
      isSearchEngine: false,
      platforms: JSON.stringify(['website']),
      searchEngines: JSON.stringify([]),
      features: JSON.stringify({}),
      sortOrder: 0,
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Cocok untuk pemula yang ingin meningkatkan traffic website',
      priceMonthly: 149000,
      priceYearly: 1490000,
      trafficLimitDaily: 5000,
      fingerprintLimit: 20,
      threadLimit: 3,
      isProxyEnabled: false,
      isAdNetworksEnabled: false,
      isBoostRpmEnabled: false,
      isVerifiedFingerprint: true,
      isViewAds: false,
      isSearchEngine: true,
      platforms: JSON.stringify(['website', 'search-engine', 'facebook', 'instagram']),
      searchEngines: JSON.stringify(['google', 'bing', 'yahoo']),
      features: JSON.stringify({}),
      sortOrder: 1,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Solusi lengkap untuk meningkatkan performa website secara maksimal',
      priceMonthly: 449000,
      priceYearly: 4490000,
      trafficLimitDaily: 25000,
      fingerprintLimit: 50,
      threadLimit: 5,
      isProxyEnabled: true,
      isAdNetworksEnabled: true,
      isBoostRpmEnabled: true,
      isVerifiedFingerprint: true,
      isViewAds: true,
      isSearchEngine: true,
      platforms: JSON.stringify(['website', 'search-engine', 'facebook', 'instagram', 'tiktok', 'youtube', 'adult', 'direct-ads']),
      searchEngines: JSON.stringify(['google', 'google-cse', 'bing', 'yandex', 'yahoo']),
      features: JSON.stringify({}),
      sortOrder: 2,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Unlimited traffic dengan fitur premium untuk bisnis besar',
      priceMonthly: 1499000,
      priceYearly: 14990000,
      trafficLimitDaily: 999999999,
      fingerprintLimit: 999999,
      threadLimit: 10,
      isProxyEnabled: true,
      isAdNetworksEnabled: true,
      isBoostRpmEnabled: true,
      isVerifiedFingerprint: true,
      isViewAds: true,
      isSearchEngine: true,
      platforms: JSON.stringify(['*']),
      searchEngines: JSON.stringify(['*']),
      features: JSON.stringify({}),
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
    console.log(`  ✅ Plan "${plan.name}" ready`);
  }

  // Create default admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vuma.id';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: passwordHash },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: 'admin',
      planId: 'enterprise',
      status: 'active',
    },
  });
  console.log(`  ✅ Admin user "${adminEmail}" created (password: ${adminPassword})`);

  // Create default traffic sources
  const sources = [
    { name: 'Google', url: 'https://www.google.com', category: 'search', isVerified: true },
    { name: 'Bing', url: 'https://www.bing.com', category: 'search', isVerified: true },
    { name: 'Yahoo', url: 'https://search.yahoo.com', category: 'search', isVerified: true },
    { name: 'Yandex', url: 'https://yandex.com', category: 'search', isVerified: true },
    { name: 'YouTube', url: 'https://www.youtube.com', category: 'video', isVerified: true },
    { name: 'Facebook', url: 'https://www.facebook.com', category: 'social', isVerified: true },
    { name: 'Instagram', url: 'https://www.instagram.com', category: 'social', isVerified: true },
    { name: 'Twitter/X', url: 'https://twitter.com', category: 'social', isVerified: true },
    { name: 'TikTok', url: 'https://www.tiktok.com', category: 'social', isVerified: true },
    { name: 'LinkedIn', url: 'https://www.linkedin.com', category: 'social', isVerified: true },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', category: 'general', isVerified: true },
    { name: 'Reddit', url: 'https://www.reddit.com', category: 'social', isVerified: true },
    { name: 'Quora', url: 'https://www.quora.com', category: 'general', isVerified: true },
    { name: 'Medium', url: 'https://medium.com', category: 'news', isVerified: true },
    { name: 'Amazon', url: 'https://www.amazon.com', category: 'general', isVerified: true },
  ];

  // Clear existing and recreate
  await prisma.trafficSource.deleteMany({});
  for (const source of sources) {
    await prisma.trafficSource.create({ data: source });
  }
  console.log(`  ✅ ${sources.length} traffic sources created`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
