const crypto = require('crypto');
const { DeviceProtocolError } = require('./errors');

// A configurable adapter for any terminal that exposes an HTTP/REST API, rather
// than ZKTeco's binary protocol -- driven entirely by the device's `settings`
// JSONB column. Defaults are pre-filled to the shape of Hikvision's public ISAPI
// standard (also followed by several OEM/Dahua-family lines), since that's the
// most common documented REST shape for these terminals, but every path/field
// name is overridable for a device that differs.
const DEFAULTS = {
  authType: 'none', // 'none' | 'basic' | 'digest' | 'bearer'
  usersPath: '/ISAPI/AccessControl/UserInfo/Search',
  logsPath: '/ISAPI/AccessControl/AcsEvent',
  usersListPath: 'UserInfoSearch.UserInfo',
  logsListPath: 'AcsEvent.InfoList',
  userIdField: 'employeeNo',
  userNameField: 'name',
  cardField: 'cardNo',
  eventUserField: 'employeeNoString',
  eventTimeField: 'time',
  eventTypeField: 'eventType',
  rejectUnauthorized: true,
};

const settingsFor = (device) => ({ ...DEFAULTS, ...(device.settings || {}) });

// Resolves a dot-path ("a.b.c") against a (possibly vendor-nested) JSON object.
const resolvePath = (obj, path) => {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
};

const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');

// RFC 2617 Digest auth: parse the server's WWW-Authenticate challenge and
// compute the matching Authorization header. Node's fetch has no built-in
// support for this, and it's a fixed public algorithm (not vendor-specific
// guesswork), so it's implemented directly here rather than pulled in as a
// dependency.
const parseDigestChallenge = (header) => {
  const params = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let match;
  while ((match = re.exec(header || '')) !== null) {
    params[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return params;
};

const buildDigestHeader = ({ username, password, method, uri, challenge }) => {
  const { realm, nonce, qop, opaque, algorithm } = challenge;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `username="${username}"`, `realm="${realm}"`, `nonce="${nonce}"`,
    `uri="${uri}"`, `response="${response}"`,
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (opaque) parts.push(`opaque="${opaque}"`);
  if (algorithm) parts.push(`algorithm=${algorithm}`);
  return `Digest ${parts.join(', ')}`;
};

const httpGet = async (device, path) => {
  const settings = settingsFor(device);
  const base = String(settings.baseUrl || `http://${device.ip_address}:${device.port || 80}`).replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers = {};
  if (settings.authType === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`;
  } else if (settings.authType === 'bearer') {
    headers.Authorization = `Bearer ${settings.token}`;
  }

  try {
    let res = await fetch(url, { headers });

    if (settings.authType === 'digest' && res.status === 401) {
      const challenge = parseDigestChallenge(res.headers.get('www-authenticate'));
      const digestHeader = buildDigestHeader({
        username: settings.username,
        password: settings.password,
        method: 'GET',
        uri: new URL(url).pathname + new URL(url).search,
        challenge,
      });
      res = await fetch(url, { headers: { ...headers, Authorization: digestHeader } });
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    throw new DeviceProtocolError(`Could not communicate with ${device.name} at ${url}. ${err.message || err}`, err);
  }
};

const fetchUsers = async (device) => {
  const settings = settingsFor(device);
  const body = await httpGet(device, settings.usersPath);
  const list = resolvePath(body, settings.usersListPath);
  const users = Array.isArray(list) ? list : [];

  return users.map((user) => {
    const deviceUserId = String(user[settings.userIdField] ?? '').trim();
    const parts = String(user[settings.userNameField] || '').trim().split(/\s+/).filter(Boolean);
    return {
      employeeCode: deviceUserId || `device-${deviceUserId}`,
      deviceUserId,
      deviceUid: null,
      deviceRole: null,
      cardNumber: user[settings.cardField] ? String(user[settings.cardField]) : null,
      firstName: parts[0] || 'Unknown',
      lastName: parts.slice(1).join(' ') || null,
      metadata: { source: 'device', rawName: user[settings.userNameField] || '', importedFields: Object.keys(user || {}) },
      raw: user,
    };
  });
};

const fetchLogs = async (device) => {
  const settings = settingsFor(device);
  const body = await httpGet(device, settings.logsPath);
  const list = resolvePath(body, settings.logsListPath);
  const logs = Array.isArray(list) ? list : [];

  return logs
    .map((record) => ({
      deviceUserId: String(record[settings.eventUserField] ?? '').trim(),
      eventTime: record[settings.eventTimeField] ? new Date(record[settings.eventTimeField]).toISOString() : new Date().toISOString(),
      eventType: record[settings.eventTypeField] || 'check',
      verifyMode: null,
      workCode: null,
      rawPayload: record,
    }))
    .filter((log) => log.deviceUserId);
};

module.exports = { fetchUsers, fetchLogs };
