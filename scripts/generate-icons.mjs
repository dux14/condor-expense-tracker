/**
 * scripts/generate-icons.mjs
 * Generates all Cóndor brand assets from the master mark
 * (scripts/assets/condor-mark-master.png — "Moneda Cóndor", Higgsfield 2048×2048).
 *
 * The master is a mint coin with the condor carved in negative space on an ink
 * background. Every pixel is normalized to the exact brand tokens (the AI master
 * drifts slightly), producing two 2048px sources:
 *   - tile: opaque, ink background  → app icons, apple icon, maskable
 *   - coin: transparent background AND transparent condor cutout (true negative
 *           space) → favicon, in-app logo on any theme
 *
 * Uses sharp. Run with: node scripts/generate-icons.mjs
 */

import sharp from '../node_modules/sharp/lib/index.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER = join(__dirname, 'assets', 'condor-mark-master.png');
const OUT_DIR = join(__dirname, '..', 'public', 'icons');
const BRAND_DIR = join(__dirname, '..', 'public', 'brand');
const APP_DIR = join(__dirname, '..', 'app');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(BRAND_DIR, { recursive: true });

// Brand tokens — keep in sync with app/globals.css (--condor-primary / --bg);
// a color tweak there won't propagate to generated icons unless mirrored here.
const MINT = { r: 0x4e, g: 0xcd, b: 0xaa }; // #4ECDAA → --condor-primary
const INK = { r: 0x0e, g: 0x13, b: 0x1f }; // #0E131F → --bg (dark)

// Coin geometry in the 2048px master (measured): centre ≈ 1024, diameter ≈ 1365
const MASTER_SIZE = 2048;
const COIN_DIAMETER = 1365;

/**
 * Read the master once and build the two normalized 2048px sources.
 * Mintness t of a pixel is derived from its green-dominance (ink: g-r≈7,
 * mint: g-r≈117) so antialiased edges keep a smooth blend.
 */
async function buildSources() {
  const { data, info } = await sharp(MASTER)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const tile = Buffer.alloc(n * 3);
  const coin = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const s = i * info.channels;
    const gd = data[s + 1] - data[s]; // green-dominance
    const t = Math.min(1, Math.max(0, (gd - 7) / 110));
    tile[i * 3] = Math.round(INK.r + (MINT.r - INK.r) * t);
    tile[i * 3 + 1] = Math.round(INK.g + (MINT.g - INK.g) * t);
    tile[i * 3 + 2] = Math.round(INK.b + (MINT.b - INK.b) * t);
    coin[i * 4] = MINT.r;
    coin[i * 4 + 1] = MINT.g;
    coin[i * 4 + 2] = MINT.b;
    coin[i * 4 + 3] = Math.round(255 * t);
  }
  const raw = (buf, channels) =>
    sharp(buf, { raw: { width: info.width, height: info.height, channels } });
  return {
    tile: await raw(tile, 3).png().toBuffer(),
    coin: await raw(coin, 4).png().toBuffer(),
  };
}

/** Crop a centred square so the coin occupies `coinRatio` of the side, then resize. */
function renderMark(srcPng, size, coinRatio) {
  const side = Math.min(MASTER_SIZE, Math.round(COIN_DIAMETER / coinRatio));
  const off = Math.round((MASTER_SIZE - side) / 2);
  return sharp(srcPng)
    .extract({ left: off, top: off, width: side, height: side })
    .resize(size, size)
    // The mark is two flat colours — palette quantization shrinks the file
    // dramatically with no visible loss.
    .png({ palette: true, compressionLevel: 9 })
    .toBuffer();
}

/** Pack multiple PNG buffers into a valid multi-size .ico (PNG-encoded entries). */
function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const datas = [];
  images.forEach((img, i) => {
    const e = 16 * i;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0); // width (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // planes
    dir.writeUInt16LE(32, e + 6); // bit depth
    dir.writeUInt32LE(img.buf.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += img.buf.length;
    datas.push(img.buf);
  });
  return Buffer.concat([header, dir, ...datas]);
}

async function write(absPath, buf, label) {
  writeFileSync(absPath, buf);
  console.log(`  generated ${absPath}${label ? ` (${label})` : ''}`);
}

console.log('Generating Cóndor brand assets from master…');
const { tile, coin } = await buildSources();

// PWA icons — opaque ink tiles, coin at 78% for strong presence
await write(join(OUT_DIR, 'icon-192.png'), await renderMark(tile, 192, 0.78), '192x192');
await write(join(OUT_DIR, 'icon-512.png'), await renderMark(tile, 512, 0.78), '512x512');
// Maskable — coin at 70% so it clears the 80% safe-zone circle on any mask
await write(
  join(OUT_DIR, 'icon-maskable-512.png'),
  await renderMark(tile, 512, 0.7),
  '512x512 maskable',
);

// In-app logo — transparent coin (negative-space condor shows the page
// background). 512px covers the largest in-app render (120px @3x).
await write(join(BRAND_DIR, 'condor-mark.png'), await renderMark(coin, 512, 0.96), '512x512 transparent');

// Next.js file-convention icons
await write(join(APP_DIR, 'icon.png'), await renderMark(coin, 256, 0.96), '256x256 transparent');
await write(join(APP_DIR, 'apple-icon.png'), await renderMark(tile, 180, 0.78), '180x180 opaque');

// Legacy / scraper favicon.ico — transparent coin, near-full-bleed for 16px legibility
const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({ size, buf: await renderMark(coin, size, 0.96) })),
);
await write(join(APP_DIR, 'favicon.ico'), buildIco(icoImages), '16/32/48');
console.log('Done.');
