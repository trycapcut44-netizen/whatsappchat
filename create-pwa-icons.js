const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Helper to create CRC32 table and compute CRC
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generatePng(size) {
  const width = size;
  const height = size;
  
  // Raw scanlines: for each row, 1 filter byte (0) + 4 bytes per pixel (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if inside circle
      if (dist <= radius) {
        // WhatsApp Business Green #25D366
        let r = 0x25;
        let g = 0xd3;
        let b = 0x66;
        let a = 0xff;

        // Anti-aliasing edge
        if (dist > radius - 1.5) {
          a = Math.floor(0xff * (radius - dist) / 1.5);
        }

        // Draw letter 'B' in center
        // Normalize coordinates to [-1, 1] relative to center
        const nx = (x - cx) / (width * 0.28);
        const ny = (y - cy) / (height * 0.28);

        // Letter B bounding box: -0.6 <= nx <= 0.6, -0.7 <= ny <= 0.7
        let inB = false;
        if (nx >= -0.55 && nx <= 0.55 && ny >= -0.7 && ny <= 0.7) {
          // Vertical spine
          if (nx <= -0.2) inB = true;

          // Top loop
          if (ny <= 0 && nx >= -0.3) {
            const lcx = -0.05, lcy = -0.35, r1 = 0.35, r2 = 0.16;
            const dloop = Math.sqrt((nx - lcx) * (nx - lcx) + (ny - lcy) * (ny - lcy));
            if (dloop <= r1 && (dloop >= r2 || nx < lcx)) inB = true;
          }

          // Bottom loop
          if (ny >= 0 && nx >= -0.3) {
            const lcx = -0.02, lcy = 0.35, r1 = 0.37, r2 = 0.17;
            const dloop = Math.sqrt((nx - lcx) * (nx - lcx) + (ny - lcy) * (ny - lcy));
            if (dloop <= r1 && (dloop >= r2 || nx < lcx)) inB = true;
          }
        }

        if (inB) {
          // White letter B
          r = 0xff;
          g = 0xff;
          b = 0xff;
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk (compressed rawData)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const assetsDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), generatePng(512));
console.log('✓ Successfully created 192x192 and 512x512 PWA icons for WhatsApp Business');
