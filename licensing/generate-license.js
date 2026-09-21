#!/usr/bin/env node
// Run this by you (the vendor), once per sale.
//
//   node licensing/generate-license.js --machine-id A1B2-C3D4-... --licensee "Client Business Name"
//
// Prints a license blob to hand to the client (paste into the app's
// Activate License screen, or save as a .lic file). Requires
// licensing/private-key.pem from generate-keypair.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1];
}

if (!args['machine-id'] || !args['licensee']) {
  console.error('Usage: node licensing/generate-license.js --machine-id <id> --licensee "<name>"');
  process.exit(1);
}

const keyPath = path.join(__dirname, 'private-key.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`No private key at ${keyPath} -- run generate-keypair.js first.`);
  process.exit(1);
}
const privateKey = fs.readFileSync(keyPath, 'utf8');

const payload = {
  licenseId: crypto.randomUUID(),
  licensee: args['licensee'],
  machineId: args['machine-id'],
  issuedAt: new Date().toISOString(),
};

const payloadJson = JSON.stringify(payload);
const signature = crypto.sign(null, Buffer.from(payloadJson, 'utf8'), privateKey);

const blob = `${Buffer.from(payloadJson).toString('base64')}.${signature.toString('base64')}`;

console.log('\nLicense generated for:', payload.licensee);
console.log('Machine ID:', payload.machineId);
console.log('\n--- Paste this whole line into the Activate License screen ---\n');
console.log(blob);
console.log('');
