#!/usr/bin/env node

/**
 * Patch vumatraffic client to point to your server
 *
 * Usage:
 *   node patch-client.js https://api.vuma.id
 *   node patch-client.js http://localhost:3080
 */

const fs = require('fs');
const path = require('path');

const newUrl = process.argv[2];

if (!newUrl) {
  console.error('Usage: node patch-client.js <server-url>');
  console.error('Example: node patch-client.js https://api.vuma.id');
  process.exit(1);
}

// Path to vuma client package.json
const clientPackagePath = path.join(__dirname, '..', 'package.json');

if (!fs.existsSync(clientPackagePath)) {
  console.error('Error: Client package.json not found at', clientPackagePath);
  process.exit(1);
}

// Read and update
const pkg = JSON.parse(fs.readFileSync(clientPackagePath, 'utf-8'));
const oldHomepage = pkg.homepage;

pkg.homepage = newUrl;

fs.writeFileSync(clientPackagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('');
console.log('✅ Client patched successfully!');
console.log('');
console.log(`   Old URL: ${oldHomepage}`);
console.log(`   New URL: ${newUrl}`);
console.log('');
console.log('The vuma client will now connect to your server.');
console.log('Run "vuma login" to test the connection.');
console.log('');
