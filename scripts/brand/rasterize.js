/*
 * Raster derivatives of the ArchMind SVG masters (run after generate_brand_svgs.py).
 *   npm i --no-save sharp   (or SHARP_PATH=/path/to/node_modules/sharp)
 *   node scripts/brand/rasterize.js
 */
const fs = require('fs')
const path = require('path')
const sharp = require(process.env.SHARP_PATH || 'sharp')

const PUB = path.join(__dirname, '..', '..', 'public')
const BRAND = path.join(PUB, 'brand')
const read = (p) => fs.readFileSync(path.join(BRAND, p))

// Small sizes use the simplified symbol (fewer, heavier lines) so it stays legible.
const iconSvg = (size) => read(size < 72 ? 'icons/app-icon-small.svg' : 'icons/app-icon.svg')
const png = (svg, w, h = w) => sharp(svg, { density: Math.max(72, Math.ceil((72 * w) / 512) * 2) }).resize(w, h).png({ compressionLevel: 9 }).toBuffer()

function ico(pngs) {
  // ICO container with embedded PNG images (supported by every current browser/OS).
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + 16 * pngs.length
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

;(async () => {
  const out = []
  const write = async (rel, buf) => { fs.mkdirSync(path.dirname(path.join(PUB, rel)), { recursive: true }); fs.writeFileSync(path.join(PUB, rel), buf); out.push(`${rel} (${buf.length} B)`) }

  const fav = []
  for (const size of [16, 32, 48]) {
    const data = await png(iconSvg(size), size)
    fav.push({ size, data })
    await write(`brand/icons/favicon-${size}x${size}.png`, data)
  }
  await write('favicon.ico', ico(fav))
  for (const size of [72, 96, 128, 144, 152, 192, 256, 384, 512, 1024]) await write(`brand/icons/icon-${size}x${size}.png`, await png(iconSvg(size), size))
  await write('apple-touch-icon.png', await png(iconSvg(180), 180))
  await write('brand/social/archmind-og-1200x630.png', await sharp(read('social/archmind-og.svg'), { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toBuffer())
  await write('brand/social/archmind-profile-1024.png', await png(iconSvg(1024), 1024))
  console.log(out.join('\n'))
})().catch((e) => { console.error(e); process.exit(1) })
