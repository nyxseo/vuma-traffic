-- =============================================
-- Vuma Traffic - Database Migration
-- Jalankan di Supabase SQL Editor
-- https://supabase.com/dashboard/project/izqrxlerqdffomzcffsq/sql
-- =============================================

-- Buat semua tabel
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
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
);

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
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
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'manual',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrafficSource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrafficSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Fingerprint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fp" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "os" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fingerprint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE UNIQUE INDEX "Fingerprint_fp_key" ON "Fingerprint"("fp");

-- Foreign Keys
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- Seed: Default Plans
-- =============================================
INSERT INTO "Plan" ("id","name","description","priceMonthly","priceYearly","trafficLimitDaily","fingerprintLimit","threadLimit","isProxyEnabled","isAdNetworksEnabled","isBoostRpmEnabled","isVerifiedFingerprint","isViewAds","isSearchEngine","platforms","searchEngines","sortOrder") VALUES
('free','Free','Coba Vuma Traffic secara gratis tanpa ribet',0,0,500,5,1,false,false,false,false,false,false,'["website"]','[]',0),
('starter','Starter','Cocok untuk pemula yang ingin meningkatkan traffic website',149000,1490000,5000,20,3,false,false,false,true,false,true,'["website","search-engine","facebook","instagram"]','["google","bing","yahoo"]',1),
('pro','Pro','Solusi lengkap untuk meningkatkan performa website secara maksimal',449000,4490000,25000,50,5,true,true,true,true,true,true,'["website","search-engine","facebook","instagram","tiktok","youtube","adult","direct-ads"]','["google","google-cse","bing","yandex","yahoo"]',2),
('enterprise','Enterprise','Unlimited traffic dengan fitur premium untuk bisnis besar',1499000,14990000,999999999,999999,10,true,true,true,true,true,true,'["*"]','["*"]',3);

-- =============================================
-- Seed: Default Admin User
-- password: admin123 (bcrypt)
-- WAJIB GANTI PASSWORD SETELAH LOGIN PERTAMA!
-- =============================================
INSERT INTO "User" ("id","name","email","passwordHash","role","planId","status") VALUES
('00000000-0000-0000-0000-000000000001','Super Admin','admin@vuma.id','$2b$10$rRnmMcKPqGZlWiuDPZpHvOHJJVOiJJOYJJGDjFJJGDjFJJGDjFJJG','admin','enterprise','active');

-- Note: Admin password hash di atas adalah placeholder
-- Server akan override saat seed.js dijalankan
-- =============================================
-- Seed: Traffic Sources
-- =============================================
INSERT INTO "TrafficSource" ("id","url","name","category","isActive","isVerified") VALUES
(gen_random_uuid()::text,'https://www.google.com','Google','search',true,true),
(gen_random_uuid()::text,'https://www.bing.com','Bing','search',true,true),
(gen_random_uuid()::text,'https://search.yahoo.com','Yahoo','search',true,true),
(gen_random_uuid()::text,'https://yandex.com','Yandex','search',true,true),
(gen_random_uuid()::text,'https://www.youtube.com','YouTube','video',true,true),
(gen_random_uuid()::text,'https://www.facebook.com','Facebook','social',true,true),
(gen_random_uuid()::text,'https://www.instagram.com','Instagram','social',true,true),
(gen_random_uuid()::text,'https://twitter.com','Twitter/X','social',true,true),
(gen_random_uuid()::text,'https://www.tiktok.com','TikTok','social',true,true),
(gen_random_uuid()::text,'https://www.linkedin.com','LinkedIn','social',true,true),
(gen_random_uuid()::text,'https://www.wikipedia.org','Wikipedia','general',true,true),
(gen_random_uuid()::text,'https://www.reddit.com','Reddit','social',true,true),
(gen_random_uuid()::text,'https://www.quora.com','Quora','general',true,true),
(gen_random_uuid()::text,'https://medium.com','Medium','news',true,true),
(gen_random_uuid()::text,'https://www.amazon.com','Amazon','general',true,true);
