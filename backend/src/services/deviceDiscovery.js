const net = require('net');
const os = require('os');

const DEFAULT_PORT = 4370;

const probeTcp = (host, port = DEFAULT_PORT, timeout = 350) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (online) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(online);
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });

const localPrefixes = () => {
  const prefixes = new Set();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const parts = entry.address.split('.');
      if (parts.length === 4) prefixes.add(parts.slice(0, 3).join('.'));
    }
  }
  return [...prefixes];
};

const discoverDevices = async ({ port = DEFAULT_PORT, prefix, timeout = 350, limit = 254 } = {}) => {
  const prefixes = prefix ? [prefix] : localPrefixes();
  const candidates = [];

  for (const networkPrefix of prefixes) {
    for (let host = 1; host <= Math.min(limit, 254); host += 1) {
      candidates.push(`${networkPrefix}.${host}`);
    }
  }

  const found = [];
  const batchSize = 32;
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const checks = await Promise.all(batch.map(async (ipAddress) => ({
      ipAddress,
      port,
      online: await probeTcp(ipAddress, port, timeout),
    })));
    found.push(...checks.filter((item) => item.online));
  }

  return found.map((item) => ({
    ...item,
    protocol: 'zkteco',
    brand: 'standard',
    status: 'online',
  }));
};

module.exports = { DEFAULT_PORT, probeTcp, discoverDevices };
