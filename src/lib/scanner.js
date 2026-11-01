import jsQR from 'jsqr';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1800;

function readQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser does not support image scanning.');
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  return result?.data ?? null;
}

export async function decodeImageFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPG, WebP, GIF or BMP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Use an image smaller than 12 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not read this image.'));
      image.src = url;
    });
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (!naturalWidth || !naturalHeight) throw new Error('This image is empty.');
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser does not support image scanning.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = readQrFromCanvas(canvas);
    if (!result) throw new Error('No readable QR code found. Try a sharper image.');
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Owns the camera tracks, animation frame, and temporary canvas. */
export class CameraScanner {
  constructor(video, onDecoded) {
    this.video = video;
    this.onDecoded = onDecoded;
    this.stream = null;
    this.frame = null;
    this.lastScanAt = 0;
    this.canvas = document.createElement('canvas');
    this.active = false;
    this.startToken = 0;
  }

  async start() {
    this.stop();
    const token = ++this.startToken;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires HTTPS and a supported browser.');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
    } catch (error) {
      if (error?.name === 'NotAllowedError') throw new Error('Camera permission was denied. You can still upload an image.');
      if (error?.name === 'NotFoundError') throw new Error('No camera was found on this device.');
      throw new Error('Camera could not start. Try uploading an image instead.');
    }
    if (token !== this.startToken) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch {
      this.stop();
      throw new Error('The video preview could not start.');
    }
    if (token !== this.startToken) return false;
    this.active = true;
    this.frame = requestAnimationFrame(this.tick);
    return true;
  }

  tick = (timestamp) => {
    if (!this.active) return;
    if (timestamp - this.lastScanAt > 150 && this.video.readyState >= 2 && this.video.videoWidth) {
      this.lastScanAt = timestamp;
      const scale = Math.min(1, 800 / Math.max(this.video.videoWidth, this.video.videoHeight));
      this.canvas.width = Math.round(this.video.videoWidth * scale);
      this.canvas.height = Math.round(this.video.videoHeight * scale);
      const context = this.canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const decoded = readQrFromCanvas(this.canvas);
        if (decoded) {
          this.stop();
          this.onDecoded(decoded);
          return;
        }
      }
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  stop() {
    this.startToken += 1;
    this.active = false;
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
  }
}
