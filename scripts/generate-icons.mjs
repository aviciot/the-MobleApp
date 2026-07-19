import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'logo', 'the_m_smiling_14_polygons.png');
const ASSETS = path.join(ROOT, 'assets');

// Cosmic dark background with purple glow
async function makeIcon(size, logoScale = 0.62) {
  const bg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="#1a0a3a"/>
          <stop offset="60%"  stop-color="#090520"/>
          <stop offset="100%" stop-color="#020108"/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="48%" r="40%">
          <stop offset="0%"  stop-color="#6B3FFF" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#6B3FFF" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.22}"/>
      <rect width="${size}" height="${size}" fill="url(#glow)" rx="${size * 0.22}"/>
    </svg>`
  );

  const logoSize = Math.round(size * logoScale);
  const offset = Math.round((size - logoSize) / 2);

  const logoResized = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp(bg)
    .composite([{ input: logoResized, top: offset, left: offset }])
    .png()
    .toBuffer();
}

// Foreground only (logo on transparent) for adaptive icon
async function makeForeground(size, logoScale = 0.7) {
  const logoSize = Math.round(size * logoScale);
  const offset = Math.round((size - logoSize) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{
      input: await sharp(LOGO)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer(),
      top: offset,
      left: offset,
    }])
    .png()
    .toBuffer();
}

// Solid dark background tile for adaptive icon background
async function makeBackground(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="#1a0a3a"/>
          <stop offset="100%" stop-color="#020108"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
    </svg>`
  );
}

async function run() {
  console.log('Generating icons...');

  // Main icon (1024x1024)
  await sharp(await makeIcon(1024)).toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png');

  // Android adaptive foreground (1024x1024, transparent bg)
  await sharp(await makeForeground(1024)).toFile(path.join(ASSETS, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');

  // Android adaptive background (1024x1024, solid dark)
  await sharp(await makeBackground(1024)).toFile(path.join(ASSETS, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  // Android monochrome (white logo on black, single channel)
  await sharp(LOGO)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .toFile(path.join(ASSETS, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');

  // Favicon (48x48)
  await sharp(await makeIcon(48, 0.7)).toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png');

  // Splash icon (200x200)
  await sharp(await makeIcon(200, 0.65)).toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  console.log('\nDone! All icons updated in assets/');
}

run().catch(console.error);
