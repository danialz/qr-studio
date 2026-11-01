import QRCode from 'qrcode';

const FALLBACK = { foreground: '#18162c', background: '#ffffff', shape: 'rounded', errorLevel: 'M' };
const COLORS = /^#[0-9a-f]{6}$/i;

export function normalizedOptions(options = {}) {
  const merged = { ...FALLBACK, ...options };
  return {
    foreground: COLORS.test(merged.foreground) ? merged.foreground : FALLBACK.foreground,
    background: COLORS.test(merged.background) ? merged.background : FALLBACK.background,
    shape: ['square', 'rounded', 'dots'].includes(merged.shape) ? merged.shape : FALLBACK.shape,
    errorLevel: ['L', 'M', 'Q', 'H'].includes(merged.errorLevel) ? merged.errorLevel : FALLBACK.errorLevel,
  };
}

const inFinder = (x, y, size) =>
  (x < 7 && y < 7) ||
  (x >= size - 7 && y < 7) ||
  (x < 7 && y >= size - 7);

function moduleRect(x, y, shape) {
  let offset = 0;
  let extent = 1;
  let radius = 0;
  if (shape === 'rounded') radius = 0.25;
  if (shape === 'dots') {
    offset = 0.085;
    extent = 0.83;
    radius = 0.415;
  }
  return `<rect x="${(x + offset).toFixed(3)}" y="${(y + offset).toFixed(3)}" width="${extent}" height="${extent}" rx="${radius}"/>`;
}

function finderAt(x, y, fg, bg) {
  return `<rect x="${x}" y="${y}" width="7" height="7" rx="1" fill="${fg}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="0.45" fill="${bg}"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.4" fill="${fg}"/>`;
}

/**
 * Renders an actual QR matrix from node-qrcode. No user input is interpolated
 * into markup: only validated hex colors, fixed numeric geometry and shapes.
 * Maintains ISO-required 4-module quiet zone and intact finder modules.
 */
export function createQrSvg(data, inputOptions = {}) {
  if (!data || typeof data !== 'string') throw new Error('Add content before generating a QR code.');
  const options = normalizedOptions(inputOptions);
  let code;
  try {
    code = QRCode.create(data, { errorCorrectionLevel: options.errorLevel });
  } catch {
    throw new Error('This content is too large for a QR code. Try a shorter value.');
  }
  const size = code.modules.size;
  const margin = 4;
  const total = size + margin * 2;
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (code.modules.data[y * size + x] && !inFinder(x, y, size)) {
        cells.push(moduleRect(x + margin, y + margin, options.shape));
      }
    }
  }
  const finder = [
    finderAt(margin, margin, options.foreground, options.background),
    finderAt(size - 7 + margin, margin, options.foreground, options.background),
    finderAt(margin, size - 7 + margin, options.foreground, options.background),
  ].join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 12}" height="${total * 12}" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" fill="${options.background}"/><g fill="${options.foreground}">${cells.join('')}</g>${finder}</svg>`,
    version: code.version,
    matrixSize: size,
    errorLevel: options.errorLevel,
  };
}

function luminance(hex) {
  const bytes = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = bytes.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export async function svgToPng(svg, pixels = 1200) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not render the PNG image.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((output) => output ? resolve(output) : reject(new Error('Could not export PNG.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
