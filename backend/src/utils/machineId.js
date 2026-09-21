const os = require('os');
const crypto = require('crypto');

// A stable-ish fingerprint for the machine this process is running on:
// hostname + platform + the first non-internal MAC address. Changes only if
// the server is reimaged or its NIC is swapped -- acceptable for a
// perpetual, hardware-locked license (re-issuing one is a manual request).
const getMachineId = () => {
  const interfaces = os.networkInterfaces();
  let mac = '';
  outer: for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break outer;
      }
    }
  }

  const raw = `${os.hostname()}|${os.platform()}|${mac}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();

  // Group into readable 4-char chunks, e.g. A1B2-C3D4-E5F6-...
  return hash.slice(0, 32).match(/.{1,4}/g).join('-');
};

module.exports = { getMachineId };
