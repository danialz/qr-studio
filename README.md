<div align="center">

# ◈ QR Studio

**Create. Scan. Share.**

A privacy-first QR code generator and scanner built with JavaScript.

[Live demo](https://danialz.github.io/qr-studio/) · [Report an issue](https://github.com/danialz/qr-studio/issues) · [MIT License](LICENSE)

</div>

> **Project status:** v0.1 foundation. The live demo becomes available once the code is pushed to `main`, GitHub Pages is enabled, and its first deployment succeeds.

## What it does

- **Create:** URLs, plain text, Wi-Fi configuration, and vCard contacts.
- **Customize:** square, rounded, or dot modules; foreground and background colors; error-correction levels.
- **Export:** high-resolution 1200 × 1200 PNG or scalable SVG, with no watermark.
- **Scan:** live camera QR scanning, image uploads, drag-and-drop, and pasted images.
- **Scan → Create:** edit decoded text or URL as a new styled QR code.
- **Privacy first:** QR data, images, and camera frames are processed entirely in the browser. No server, API, user account, analytics, cookies, or image uploads.
- **Accessibility:** semantic controls, keyboard-accessible tabs, announced feedback, and reduced-motion support.

## Quick start

Requires Node.js **20.19+** (Node.js 22 recommended).

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://127.0.0.1:5173/qr-studio/`).

```bash
npm test       # Unit tests for payload encoding and safety
npm run build  # Production bundle to dist/
npm run preview
```

> **Verified locally (November 1, 2026):** On Windows with Node.js 24.19.0, all 13 unit tests passed and Vite 8.3.5 completed a production build. Create, export, scan, and Scan → Create also passed manual checks. The committed `package-lock.json` is used by GitHub Actions with `npm ci` for reproducible CI builds. Cross-browser and device testing remains a separate release check.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | Vanilla JavaScript (ES modules), semantic HTML, modern CSS |
| Build | Vite 8 |
| QR matrix | [`qrcode`](https://www.npmjs.com/package/qrcode) (MIT) |
| QR scanning | [`jsqr`](https://www.npmjs.com/package/jsqr) (Apache-2.0) |
| Tests | Node.js built-in test runner |
| Hosting | GitHub Pages / GitHub Actions |

No frontend framework. No backend required. Library packages are bundled during build; the deployed app does not depend on a third-party CDN.

## Project structure

```text
src/
  lib/
    payload.js     QR content encoders, URL validation, scan classification
    qr.js          QR matrix styling, contrast scoring, PNG/SVG export
    scanner.js     Camera lifecycle and image decoding
  main.js          UI event orchestration
  styles.css       Responsive design system
public/
  favicon.svg
  robots.txt
tests/
  payload.test.js
.github/workflows/
  ci.yml
  deploy.yml
index.html
vite.config.js
```

## Enable GitHub Pages

1. Push the project to `main` after reviewing/testing it.
2. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. The deploy workflow builds Vite with `base: '/qr-studio/'` and publishes `dist/`.
4. Once GitHub reports a successful deployment, visit **https://danialz.github.io/qr-studio/**.

## Product and security notes

- QR codes are **static**. Changing the destination of a generated code requires creating a new code; no dynamic redirect service is included.
- Camera access needs browser permission and a secure origin (HTTPS or localhost). Camera tracks are stopped when leaving the scanner, hiding the tab, or unloading the page.
- Scanned URLs are displayed for user review and **never opened automatically**. Only `http:` and `https:` values get an "Open website" action.
- Low-contrast color choices are flagged. Always scan-test stylized/printed codes on a real device.
- This tool isn't a virus or phishing link detector. Treat unknown QR destinations with caution.

## Credits and license

Created by [DaNial Zameni](https://danialz.com). This repository uses the [MIT License](LICENSE).

Runtime dependencies have their **own** licenses: `qrcode` (MIT) and `jsqr` (Apache-2.0). See the linked package pages for attribution and license terms.
