import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayload, describeScan, normalizeUrl, safeExternalUrl, escapeWifi, escapeVCard } from '../src/lib/payload.js';

test('normalizes a schemeless website with HTTPS', () => {
  assert.equal(normalizeUrl('example.org/path'), 'https://example.org/path');
});

test('keeps an explicitly provided HTTP address', () => {
  assert.equal(normalizeUrl('http://example.org'), 'http://example.org/');
});

test('rejects unsupported URL schemes', () => {
  assert.throws(() => normalizeUrl('ftp://example.org'), /Only HTTP and HTTPS/);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /Only HTTP and HTTPS/);
});

test('rejects invalid URLs', () => {
  assert.throws(() => normalizeUrl(''), /required/);
  assert.throws(() => normalizeUrl('hello world'), /valid website/);
});

test('rejects unsafe scanned URL schemes', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('data:text/html,test'), null);
  assert.equal(safeExternalUrl('https://example.org'), 'https://example.org/');
});

test('escapes reserved Wi-Fi symbols', () => {
  assert.equal(escapeWifi('A;B:C\\D'), 'A\\;B\\:C\\\\D');
});

test('creates a WPA Wi-Fi QR payload', () => {
  assert.equal(createPayload('wifi', { ssid: 'Coffee;Shop', security: 'WPA', password: 'pa:ss' }), 'WIFI:T:WPA;S:Coffee\\;Shop;P:pa\\:ss;H:false;;');
});

test('does not include a password for open Wi-Fi', () => {
  assert.equal(createPayload('wifi', { ssid: 'Guest', security: 'nopass' }), 'WIFI:T:nopass;S:Guest;P:;H:false;;');
});

test('does not allow newline injection into vCard contact name', () => {
  const result = createPayload('contact', { name: 'Alice\nBEGIN:VCARD' });
  assert.ok(result.includes('FN:Alice BEGIN:VCARD'));
  assert.equal(result.match(/^BEGIN:VCARD/gm).length, 1);
});

test('escapes vCard commas, semicolons and line breaks', () => {
  assert.equal(escapeVCard('One, Two;\nThree'), 'One\\, Two\\;\\nThree');
});

test('requires valid email if provided', () => {
  assert.throws(() => createPayload('contact', { name: 'A', email: 'nope' }), /valid email/);
});

test('describes scan results without opening anything', () => {
  assert.equal(describeScan('https://example.org').kind, 'url');
  assert.equal(describeScan('WIFI:T:WPA;S:Guest;P:foo;;').kind, 'wifi');
  assert.equal(describeScan('BEGIN:VCARD\r\nVERSION:3.0').kind, 'contact');
  assert.equal(describeScan('javascript:alert(1)').kind, 'text');
});

test('enforces max QR payload size for editable text', () => {
  assert.throws(() => createPayload('text', {text: 'a'.repeat(2001)}), /too long/);
});
