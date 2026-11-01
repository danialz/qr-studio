import { createPayload, describeScan } from './lib/payload.js';
import { contrastRatio, createQrSvg, downloadBlob, svgToPng } from './lib/qr.js';
import { CameraScanner, decodeImageFile } from './lib/scanner.js';

const get = (id) => document.getElementById(id);
const state = { mode: 'create', type: 'url', shape: 'rounded', payload: '', svg: '' };
const camera = new CameraScanner(get('camera-video'), showScanResult);
let timer;
let toastTimer;

function notify(message) {
  const toast = get('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
}

function setError(elementId, message) {
  const node = get(elementId);
  node.textContent = message || '';
  node.hidden = !message;
}

function setMode(mode) {
  if (mode === 'create') stopCamera();
  state.mode = mode;
  get('create-panel').hidden = mode !== 'create';
  get('scan-panel').hidden = mode !== 'scan';
  get('mobile-preview-peek').hidden = mode !== 'create';
  get('workspace').dataset.mode = mode;
  for (const name of ['create', 'scan']) {
    const active = name === mode;
    const button = get(`mode-${name}`);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
}

function setType(type) {
  state.type = type;
  document.querySelectorAll('[data-type]').forEach((button) => {
    const active = button.dataset.type === type;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-content]').forEach((pane) => {
    pane.hidden = pane.dataset.content !== type;
  });
  updatePreview();
}

function collectFields() {
  switch (state.type) {
    case 'url': return { url: get('website').value };
    case 'text': return { text: get('plain-text').value };
    case 'wifi': return {
      ssid: get('wifi-name').value,
      security: get('wifi-security').value,
      password: get('wifi-password').value,
      hidden: get('wifi-hidden').checked,
    };
    case 'contact': return {
      name: get('contact-name').value,
      phone: get('contact-phone').value,
      email: get('contact-email').value,
    };
    default: return {};
  }
}

function updatePreview() {
  const options = {
    foreground: get('foreground').value,
    background: get('background').value,
    shape: state.shape,
    errorLevel: get('error-level').value,
  };
  get('foreground-label').textContent = options.foreground.toUpperCase();
  get('background-label').textContent = options.background.toUpperCase();
  try {
    const payload = createPayload(state.type, collectFields());
    const { svg, version, matrixSize } = createQrSvg(payload, options);
    state.payload = payload;
    state.svg = svg;
    // SVG is generated exclusively from QR matrix coordinates and validated colors.
    get('qr-preview').innerHTML = svg;
    get('qr-version').textContent = `V${version} · ${matrixSize} × ${matrixSize}`;
    get('contrast-warning').hidden = contrastRatio(options.foreground, options.background) >= 4.5;
    setError('create-error', '');
  } catch (error) {
    state.payload = '';
    state.svg = '';
    get('qr-preview').textContent = 'Add valid content to see your QR code.';
    get('qr-version').textContent = 'Version —';
    get('contrast-warning').hidden = true;
    setError('create-error', error.message);
  }
  get('download-svg').disabled = !state.svg;
  get('download-png').disabled = !state.svg;
}

function schedulePreview() {
  clearTimeout(timer);
  timer = setTimeout(updatePreview, 100);
}

async function download(format) {
  if (!state.svg) return;
  try {
    const blob = format === 'svg'
      ? new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' })
      : await svgToPng(state.svg, 1200);
    downloadBlob(blob, `qr-studio-${state.type}.${format}`);
    notify(`${format.toUpperCase()} downloaded successfully.`);
  } catch (error) {
    notify(error.message || 'Could not export this QR code.');
  }
}

function stopCamera() {
  camera.stop();
  get('camera-video').hidden = true;
  get('camera-placeholder').hidden = false;
  get('start-camera').hidden = false;
  get('stop-camera').hidden = true;
}

async function startCamera() {
  setError('scan-error', '');
  get('scan-result').hidden = true;
  const startButton = get('start-camera');
  startButton.disabled = true;
  get('camera-video').hidden = false;
  get('camera-placeholder').hidden = true;
  try {
    const started = await camera.start();
    if (started && state.mode === 'scan') {
      startButton.hidden = true;
      get('stop-camera').hidden = false;
      notify('Camera is active. Hold a QR code in view.');
    } else {
      stopCamera();
    }
  } catch (error) {
    stopCamera();
    setError('scan-error', error.message);
  } finally {
    startButton.disabled = false;
  }
}

function showScanResult(text) {
  stopCamera();
  setError('scan-error', '');
  const details = describeScan(text);
  get('scan-result-kind').textContent = details.label;
  get('scan-result-value').textContent = text;
  get('scan-result').hidden = false;
  const open = get('open-result');
  open.hidden = !details.url;
  if (details.url) open.href = details.url;
  else open.removeAttribute('href');
  notify('QR code decoded.');
}

async function scanFile(file) {
  if (!file) return;
  stopCamera();
  setMode('scan');
  get('scan-result').hidden = true;
  setError('scan-error', '');
  try {
    const value = await decodeImageFile(file);
    showScanResult(value);
  } catch (error) {
    setError('scan-error', error.message || 'Could not scan the image.');
  }
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    notify('Copied to clipboard.');
  } catch {
    notify('Clipboard access was blocked by your browser.');
  }
}

function editScannedValue() {
  const text = get('scan-result-value').textContent;
  const details = describeScan(text);
  if (details.kind === 'url') {
    get('website').value = text;
    setType('url');
  } else {
    get('plain-text').value = text;
    setType('text');
  }
  setMode('create');
  updatePreview();
  get(details.kind === 'url' ? 'website' : 'plain-text').focus();
  notify('Scanned content is ready to customize.');
}

for (const name of ['create', 'scan']) {
  get(`mode-${name}`).addEventListener('click', () => setMode(name));
}

// Arrow-key navigation for the two-tab switch.
get('mode-create').parentElement.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 'create' : event.key === 'End' ? 'scan'
    : (state.mode === 'create' ? 'scan' : 'create');
  setMode(next);
  get(`mode-${next}`).focus();
});

document.querySelectorAll('[data-type]').forEach((button) => {
  button.addEventListener('click', () => setType(button.dataset.type));
});

document.querySelectorAll('[data-shape]').forEach((button) => {
  button.addEventListener('click', () => {
    state.shape = button.dataset.shape;
    document.querySelectorAll('[data-shape]').forEach((item) => {
      const active = item.dataset.shape === state.shape;
      item.classList.toggle('is-selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updatePreview();
  });
});

const inputs = ['website', 'plain-text', 'wifi-name', 'wifi-security', 'wifi-password', 'wifi-hidden',
  'contact-name', 'contact-phone', 'contact-email', 'foreground', 'background', 'error-level'];
inputs.forEach((name) => {
  get(name).addEventListener('input', schedulePreview);
  get(name).addEventListener('change', schedulePreview);
});

get('wifi-security').addEventListener('change', () => {
  const open = get('wifi-security').value === 'nopass';
  get('wifi-password').disabled = open;
  get('wifi-password').placeholder = open ? 'Not required' : 'Network password';
});

get('download-png').addEventListener('click', () => download('png'));
get('download-svg').addEventListener('click', () => download('svg'));
get('start-camera').addEventListener('click', startCamera);
get('stop-camera').addEventListener('click', stopCamera);
get('dropzone').addEventListener('click', () => get('scan-file').click());
get('scan-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await scanFile(file);
  event.target.value = '';
});
get('copy-result').addEventListener('click', () => copyText(get('scan-result-value').textContent));
get('edit-result').addEventListener('click', editScannedValue);

for (const eventName of ['dragenter', 'dragover']) {
  get('dropzone').addEventListener(eventName, (event) => {
    event.preventDefault();
    get('dropzone').classList.add('drag-over');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  get('dropzone').addEventListener(eventName, (event) => {
    event.preventDefault();
    get('dropzone').classList.remove('drag-over');
    if (eventName === 'drop') scanFile(event.dataTransfer?.files?.[0]);
  });
}

document.addEventListener('paste', (event) => {
  if (state.mode !== 'scan') return;
  const image = [...(event.clipboardData?.files ?? [])].find((file) => file.type.startsWith('image/'));
  if (image) {
    event.preventDefault();
    scanFile(image);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
});
window.addEventListener('pagehide', stopCamera);

updatePreview();
