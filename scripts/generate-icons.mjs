/**
 * scripts/generate-icons.mjs
 * Generates Cóndor PWA icons from an inline SVG of the condor mark.
 * Uses sharp. Run with: node scripts/generate-icons.mjs
 */

import sharp from '../node_modules/sharp/lib/index.js';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

/**
 * Build a standalone SVG with the condor mark:
 * - Ink (#0E131F) rounded-rect background
 * - Mint (#4ECDAA) condor silhouette + radar ring
 * @param {number} size   total canvas size in px
 * @param {number} padding  inset from edge (for maskable safe-zone)
 */
function buildSVG(size, padding = 0) {
  const inner = size - 2 * padding;
  const r = inner * 0.22; // corner radius for the tile, ~22% of inner size

  // We draw the tile centred inside the canvas using a transform translate
  const tileX = padding;
  const tileY = padding;

  // The condor viewbox is 100×100 so we scale to inner size
  const scale = inner / 100;

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${size}"
  height="${size}"
  viewBox="0 0 ${size} ${size}"
>
  <!-- Ink background tile -->
  <rect
    x="${tileX}"
    y="${tileY}"
    width="${inner}"
    height="${inner}"
    rx="${r}"
    ry="${r}"
    fill="#0E131F"
  />

  <!-- Condor mark: scaled & positioned inside the tile -->
  <g transform="translate(${tileX}, ${tileY}) scale(${scale})">

    <!-- Dashed radar ring -->
    <circle
      cx="50" cy="50" r="44"
      fill="none"
      stroke="#4ECDAA"
      stroke-width="1.8"
      stroke-dasharray="5 4"
      stroke-linecap="round"
    />

    <!-- Condor silhouette (filled, mint) -->
    <g fill="#4ECDAA">
      <!-- Body -->
      <ellipse cx="50" cy="54" rx="7" ry="9"/>
      <!-- Head -->
      <ellipse cx="45" cy="43" rx="4.5" ry="4"/>
      <!-- Beak -->
      <ellipse cx="40" cy="43.5" rx="3.5" ry="1.5"/>

      <!-- Left wing membrane -->
      <path d="M 43 50 C 30 46, 18 42, 10 36 C 14 44, 22 52, 34 55 Z"/>
      <!-- Left primary feathers -->
      <path d="M 10 36 C  8 32,  6 29,  8 25 C 11 30, 12 34, 14 38 Z"/>
      <path d="M 14 33 C 12 28, 12 24, 15 20 C 17 26, 17 30, 18 34 Z"/>
      <path d="M 18 31 C 17 26, 18 22, 22 19 C 23 25, 22 29, 22 33 Z"/>
      <path d="M 22 30 C 22 25, 24 21, 28 19 C 28 25, 27 29, 27 32 Z"/>
      <path d="M 27 30 C 27 25, 30 22, 34 21 C 33 27, 31 30, 32 33 Z"/>

      <!-- Right wing membrane -->
      <path d="M 57 50 C 70 46, 82 42, 90 36 C 86 44, 78 52, 66 55 Z"/>
      <!-- Right primary feathers -->
      <path d="M 90 36 C 92 32, 94 29, 92 25 C 89 30, 88 34, 86 38 Z"/>
      <path d="M 86 33 C 88 28, 88 24, 85 20 C 83 26, 83 30, 82 34 Z"/>
      <path d="M 82 31 C 83 26, 82 22, 78 19 C 77 25, 78 29, 78 33 Z"/>
      <path d="M 78 30 C 78 25, 76 21, 72 19 C 72 25, 73 29, 73 32 Z"/>
      <path d="M 73 30 C 73 25, 70 22, 66 21 C 67 27, 69 30, 68 33 Z"/>

      <!-- Tail -->
      <path d="M 46 63 C 45 68, 44 72, 46 75 C 48 72, 52 72, 54 75 C 56 72, 55 68, 54 63 Z"/>
    </g>
  </g>
</svg>`;
}

async function generate(filename, size, padding) {
  const svg = buildSVG(size, padding);
  const svgBuffer = Buffer.from(svg, 'utf8');
  const outPath = join(OUT_DIR, filename);
  await sharp(svgBuffer).png().toFile(outPath);
  console.log(`  generated ${outPath} (${size}x${size}, padding=${padding})`);
}

console.log('Generating Cóndor PWA icons…');
await generate('icon-192.png', 192, 0);
await generate('icon-512.png', 512, 0);
// Maskable: ~12% safe-zone padding on each side (12% of 512 = ~61px)
await generate('icon-maskable-512.png', 512, 62);
console.log('Done.');
