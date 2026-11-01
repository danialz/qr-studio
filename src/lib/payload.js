/**
 * Pure, testable payload helpers. No data leaves the user's browser.
 */
const MAX_FIELD_LENGTH = 2000;

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > MAX_FIELD_LENGTH) throw new Error(`${label} is too long.`);
  return text;
}

export function normalizeUrl(value) {
  const raw = required(value, 'Website URL');
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    throw new Error('Only HTTP and HTTPS website addresses are supported.');
  }
  if (raw.startsWith('//')) throw new Error('Enter a valid website address.');
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid website address.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Only HTTP and HTTPS website addresses are supported.');
  }
  return url.href;
}

/** Escaping required by WIFI: payloads (ZXing-style). */
export function escapeWifi(value) {
  return String(value ?? '').replace(/([\\;,:"'])/g, '\\$1');
}

/** RFC 6350-style field escaping, keeping each field on its own vCard line. */
export function escapeVCard(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function createPayload(kind, fields = {}) {
  switch (kind) {
    case 'url':
      return normalizeUrl(fields.url);
    case 'text':
      return required(fields.text, 'Text');
    case 'wifi': {
      const ssid = required(fields.ssid, 'Network name');
      const auth = fields.security === 'nopass' ? 'nopass' : fields.security === 'WEP' ? 'WEP' : 'WPA';
      const password = String(fields.password ?? '');
      if (auth !== 'nopass' && !password) throw new Error('Enter the Wi-Fi password.');
      if (password.length > MAX_FIELD_LENGTH) throw new Error('Wi-Fi password is too long.');
      const hidden = fields.hidden === true ? 'true' : 'false';
      return `WIFI:T:${auth};S:${escapeWifi(ssid)};P:${auth === 'nopass' ? '' : escapeWifi(password)};H:${hidden};;`;
    }
    case 'contact': {
      const name = required(fields.name, 'Contact name').replace(/\r\n|\r|\n/g, ' ');
      const phone = String(fields.phone ?? '').trim();
      const email = String(fields.email ?? '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Enter a valid email address.');
      }
      if (phone.length > 100 || email.length > 254) throw new Error('Contact details are too long.');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVCard(name)}`];
      if (phone) lines.push(`TEL:${escapeVCard(phone)}`);
      if (email) lines.push(`EMAIL:${escapeVCard(email)}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    }
    default:
      throw new Error('Unsupported QR content type.');
  }
}

/** Never turn untrusted QR contents into javascript:, data:, or file: links. */
export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function describeScan(value) {
  if (safeExternalUrl(value)) return { kind: 'url', label: 'Website', url: safeExternalUrl(value) };
  if (/^WIFI:/i.test(value)) return { kind: 'wifi', label: 'Wi-Fi network', url: null };
  if (/^BEGIN:VCARD\r?\n/i.test(value)) return { kind: 'contact', label: 'Contact card', url: null };
  return { kind: 'text', label: 'Plain text', url: null };
}
