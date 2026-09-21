#!/usr/bin/env node
// Run this ONCE, by you (the vendor), not by clients. Generates the Ed25519
// keypair used to sign/verify license files.
//
//   node licensing/generate-keypair.js
//
// Writes the private key to licensing/private-key.pem (gitignored -- never
// commit or hand this to a client) and prints the public key to paste into
// backend/src/config/license-public-key.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keyPath = path.join(__dirname, 'private-key.pem');

if (fs.existsSync(keyPath)) {
  console.error(`A keypair already exists at ${keyPath}.`);
  console.error('Delete it first if you really want to generate a new one --');
  console.error('doing so invalidates every license file you have already issued.');
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
console.log(`Private key written to ${keyPath} -- keep this safe and out of git.\n`);

const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
console.log('Paste this into backend/src/config/license-public-key.js:\n');
console.log(`const PUBLIC_KEY_PEM = \`${publicPem.trim()}\`;`);
