/**
 * Vuma Traffic - Supabase Migration Script
 * Jalankan: node migrate-supabase.js
 * 
 * Script ini akan:
 * 1. Membuat semua tabel di Supabase (jika belum ada)
 * 2. Mengisi data default (plans, admin user, traffic sources)
 * 3. Menggunakan Prisma runtime via pooler connection
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('=== Vuma Traffic - Supabase Migration ===\n');

  // Check existing tables
  const result = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'"
  );
  const tables = result.map((r) => r.tablename);
  console.log('Existing tables:', tables.length ? tables.join(', ') : '(none)');

  // ============ CREATE TABLES ============
  console.log('\n📦 Creating tables...');

  const createTable = async (name, sql) => {
    if (tables.includes(name)) {
      console.log(`  ⏭️  ${name} already exists`);
      return;
    }
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✅ ${name} created`);
  };

  await createTable('User', `
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'user',
      "planId" TEXT NOT NULL DEFAULT 'free',
      "machineId" TEXT NOT NULL DEFAULT '',
      "ipAddress" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "totalHitsToday" INTEGER NOT NULL DEFAULT 0,
      "totalHitsAll" INTEGER NOT NULL DEFAULT 0,
      "dataUsedToday" INTEGER NOT NULL DEFAULT 0,
      "lastActiveAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('Plan', `
    CREATE TABLE IF NOT EXISTS "Plan" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceYearly" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "trafficLimitDaily" INTEGER NOT NULL DEFAULT 500,
      "fingerprintLimit" INTEGER NOT NULL DEFAULT 5,
      "threadLimit" INTEGER NOT NULL DEFAULT 1,
      "isProxyEnabled" BOOLEAN NOT NULL DEFAULT false,
      "isAdNetworksEnabled" BOOLEAN NOT NULL DEFAULT false,
      "isBoostRpmEnabled" BOOLEAN NOT NULL DEFAULT false,
      "isVerifiedFingerprint" BOOLEAN NOT NULL DEFAULT false,
      "isViewAds" BOOLEAN NOT NULL DEFAULT false,
      "isSearchEngine" BOOLEAN NOT NULL DEFAULT false,
      "platforms" TEXT NOT NULL DEFAULT '[]',
      "searchEngines" TEXT NOT NULL DEFAULT '[]',
      "features" TEXT NOT NULL DEFAULT '{}',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('Transaction', `
    CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL DEFAULT 'manual',
      "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paidAt" TIMESTAMP(3),
      CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('ApiKey', `
    CREATE TABLE IF NOT EXISTS "ApiKey" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'default',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastUsedAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('TrafficSource', `
    CREATE TABLE IF NOT EXISTS "TrafficSource" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "url" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'general',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isVerified" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficSource_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('Fingerprint', `
    CREATE TABLE IF NOT EXISTS "Fingerprint" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "fp" TEXT NOT NULL,
      "device" TEXT NOT NULL DEFAULT '',
      "os" TEXT NOT NULL DEFAULT '',
      "browser" TEXT NOT NULL DEFAULT '',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Fingerprint_pkey" PRIMARY KEY ("id")
    )
  `);

  await createTable('Log', `
    CREATE TABLE IF NOT EXISTS "Log" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "detail" TEXT NOT NULL DEFAULT '',
      "ip" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
    )
  `);

  // ============ INDEXES ============
  console.log('\n📌 Creating indexes...');
  
  const createIndex = async (name, sql) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✅ ${name}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`  ⏭️  ${name} already exists`);
      } else {
        throw e;
      }
    }
  };

  await createIndex('User_email_key',   'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")');
  await createIndex('Plan_name_key',     'CREATE UNIQUE INDEX IF NOT EXISTS "Plan_name_key" ON "Plan"("name")');
  await createIndex('ApiKey_key_key',    'CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_key" ON "ApiKey"("key")');
  await createIndex('Fingerprint_fp_key','CREATE UNIQUE INDEX IF NOT EXISTS "Fingerprint_fp_key" ON "Fingerprint"("fp")');

  // ============ SEED DATA ============
  console.log('\n🌱 Seeding data...');

  const planCount = await prisma.plan.count();
  if (planCount === 0) {
    console.log('  Creating default plans...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Plan" ("id","name","description","priceMonthly","priceYearly",
        "trafficLimitDaily","fingerprintLimit","threadLimit",
        "isProxyEnabled","isAdNetworksEnabled","isBoostRpmEnabled",
        "isVerifiedFingerprint","isViewAds","isSearchEngine",
        "platforms","searchEngines","sortOrder")
      VALUES
        ('free','Free','Coba Vuma Traffic gratis',0,0,500,5,1,
         false,false,false,false,false,false,'["website"]','[]',0),
        ('starter','Starter','Cocok untuk pemula',149000,1490000,5000,20,3,
         false,false,false,true,false,true,'["website","search-engine","facebook","instagram"]','["google","bing","yahoo"]',1),
        ('pro','Pro','Solusi lengkap',449000,4490000,25000,50,5,
         true,true,true,true,true,true,'["*"]','["*"]',2),
        ('enterprise','Enterprise','Unlimited traffic',1499000,14990000,999999999,999999,10,
         true,true,true,true,true,true,'["*"]','["*"]',3)
    `);
    console.log('  ✅ Plans seeded');
  } else {
    console.log(`  ⏭️  Plans already exist (${planCount} found)`);
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('  Creating admin user...');
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" ("id","name","email","passwordHash","role","planId","status")
      VALUES ('00000000-0000-0000-0000-000000000001','Super Admin','admin@vuma.id','${hash.replace(/'/g, "''")}','admin','enterprise','active')
    `);
    console.log('  ✅ Admin user created (admin@vuma.id / admin123)');
  } else {
    console.log(`  ⏭️  Users already exist (${userCount} found)`);
  }

  const sourceCount = await prisma.trafficSource.count();
  if (sourceCount === 0) {
    console.log('  Creating traffic sources...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "TrafficSource" ("url","name","category")
      VALUES
        ('https://www.google.com','Google','search'),
        ('https://www.bing.com','Bing','search'),
        ('https://search.yahoo.com','Yahoo','search'),
        ('https://yandex.com','Yandex','search'),
        ('https://www.youtube.com','YouTube','video'),
        ('https://www.facebook.com','Facebook','social'),
        ('https://www.instagram.com','Instagram','social'),
        ('https://twitter.com','Twitter/X','social'),
        ('https://www.tiktok.com','TikTok','social'),
        ('https://www.linkedin.com','LinkedIn','social'),
        ('https://www.wikipedia.org','Wikipedia','general'),
        ('https://www.reddit.com','Reddit','social'),
        ('https://www.quora.com','Quora','general'),
        ('https://medium.com','Medium','news'),
        ('https://www.amazon.com','Amazon','general')
    `);
    console.log('  ✅ Traffic sources seeded');
  } else {
    console.log(`  ⏭️  Traffic sources already exist (${sourceCount} found)`);
  }

  console.log('\n🎉 Migration complete!');
  console.log('Server sudah bisa dijalankan dengan: npm run dev');
}

main()
  .catch((e) => {
    console.error('\n❌ Migration failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
