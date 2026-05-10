// Generates PNG icons from icon.svg using sharp.
// To change the icon, edit icon.svg and run: node generate-icons.js
//
// Requires sharp: npm install --no-save sharp

// One-liner script to install sharp, generate png, and remove sharp:
// npm install --no-save sharp && node generate-icons.js && rmdir /s /q node_modules 2>nul

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is not installed. Run: npm install --no-save sharp');
  process.exit(1);
}

const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'));
const sizes = [16, 48, 128];

Promise.all(
  sizes.map((size) => {
    const outPath = path.join(__dirname, `icon-${size}.png`);
    return sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outPath)
      .then((info) => console.log(`Created ${outPath} (${info.size} bytes)`));
  })
).catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
