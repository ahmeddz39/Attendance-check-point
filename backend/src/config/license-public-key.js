// Public half of the vendor's Ed25519 license-signing keypair. Safe to ship
// -- it can only verify signatures, never create them. Generate the pair
// once with `node licensing/generate-keypair.js` and paste the printed
// public key here; keep the private key (licensing/private-key.pem) off
// this repo entirely.
//
// Until this is set, no license blob can ever verify, so every install is
// unlicensed by default -- that's the safe default, not a bug.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/D5hGc9noD0lJ6tcJ9/IMoZRXZa81SuBFLVwsUYHxC0=
-----END PUBLIC KEY-----`;

module.exports = { PUBLIC_KEY_PEM };
