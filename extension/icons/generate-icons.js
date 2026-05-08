// Generates PNG icons from scratch using pure pixel data (no canvas dependency)
// Creates simple colored square icons with "QA" implied by the color scheme

const fs = require('fs');
const path = require('path');

// Minimal PNG encoder - creates a solid colored rounded-ish icon
function createPNG(size) {
  // We'll create the PNG manually
  const { createCanvas } = (() => {
    // Try to use canvas module, fall back to raw PNG generation
    try { return require('canvas'); } catch { return {}; }
  })();

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background with rounded corners
    const r = size * 0.125;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#6366f1';
    ctx.fill();
    
    // "QA" text
    const fontSize = Math.floor(size * 0.375);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QA', size / 2, size / 2);
    
    return canvas.toBuffer('image/png');
  }
  
  // Fallback: generate a minimal valid PNG with solid color
  return generateMinimalPNG(size);
}

function generateMinimalPNG(size) {
  const zlib = require('zlib');
  
  // RGBA pixel data
  const rowBytes = size * 4 + 1; // +1 for filter byte
  const raw = Buffer.alloc(rowBytes * size);
  
  const r = Math.floor(size * 0.125);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      // Simple rounded rect check
      const inRect = isInsideRoundedRect(x, y, size, size, r);
      if (inRect) {
        raw[px] = 0x63;     // R
        raw[px + 1] = 0x66; // G
        raw[px + 2] = 0xf1; // B
        raw[px + 3] = 0xff; // A
      } else {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
      }
    }
  }
  
  const deflated = zlib.deflateSync(raw);
  
  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createChunk('IHDR', (() => {
    const b = Buffer.alloc(13);
    b.writeUInt32BE(size, 0);
    b.writeUInt32BE(size, 4);
    b[8] = 8;  // bit depth
    b[9] = 6;  // color type: RGBA
    b[10] = 0; // compression
    b[11] = 0; // filter
    b[12] = 0; // interlace
    return b;
  })());
  const idat = createChunk('IDAT', deflated);
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function isInsideRoundedRect(x, y, w, h, r) {
  if (x < r && y < r) return dist(x, y, r, r) <= r;
  if (x >= w - r && y < r) return dist(x, y, w - r - 1, r) <= r;
  if (x < r && y >= h - r) return dist(x, y, r, h - r - 1) <= r;
  if (x >= w - r && y >= h - r) return dist(x, y, w - r - 1, h - r - 1) <= r;
  return true;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate all three sizes
const sizes = [16, 48, 128];
const dir = __dirname;

for (const size of sizes) {
  const png = createPNG(size);
  const outPath = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}
