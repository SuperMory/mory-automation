// generate-icons.js
// Generate valid PNG icons for Chrome Extension without external dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with scanlines
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData.writeUInt8(0, offset++); // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Draw rounded rectangle with icon design (Green RPA Flow)
      const cx = width / 2;
      const cy = height / 2;
      const radius = width * 0.44;
      const dist = Math.hypot(x - cx, y - cy);

      // Icon color: emerald green theme (#10b981 / #059669)
      if (dist <= radius) {
        // Subtle gradient
        const t = y / height;
        const curR = Math.round(16 + (5 - 16) * t);
        const curG = Math.round(185 + (150 - 185) * t);
        const curB = Math.round(129 + (105 - 129) * t);

        // Draw inner geometric arrow / bot flow mark
        const innerX = (x - cx) / (width * 0.35);
        const innerY = (y - cy) / (height * 0.35);

        // Fast check if inside simple stylized cursor/arrow
        const isArrow = (innerX >= -0.5 && innerX <= 0.4 && innerY >= -0.5 && innerY <= 0.5 && (innerX - innerY < 0.4));
        if (isArrow) {
          rawData.writeUInt8(255, offset++);
          rawData.writeUInt8(255, offset++);
          rawData.writeUInt8(255, offset++);
          rawData.writeUInt8(255, offset++);
        } else {
          rawData.writeUInt8(curR, offset++);
          rawData.writeUInt8(curG, offset++);
          rawData.writeUInt8(curB, offset++);
          rawData.writeUInt8(255, offset++);
        }
      } else {
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcVal = calcCrc(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function calcCrc(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

[16, 48, 128, 256].forEach(size => {
  const png = createPng(size, size, 16, 185, 129);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
