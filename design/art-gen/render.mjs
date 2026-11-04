// Rasterises generated SVG in headless Chromium: draws at `scale`x into a canvas,
// downsamples with high-quality smoothing, and encodes PNG or WebP in the page.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dir = readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop();
  const bin = dir && join(cache, dir, 'chrome-linux64', 'chrome');
  return bin && existsSync(bin) ? bin : undefined;
}

export async function withRasterizer(fn) {
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0"></body></html>');
  const rasterize = async (svg, { width, height, scale = 2, type = 'image/png', quality = 0.9 }) => {
    const dataUrl = await page.evaluate(
      async ({ svg, width, height, scale, type, quality }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await img.decode();
        const big = document.createElement('canvas');
        big.width = width * scale;
        big.height = height * scale;
        big.getContext('2d').drawImage(img, 0, 0, big.width, big.height);
        // Halve repeatedly for clean downsampling
        let src = big;
        while (src.width / 2 >= width) {
          const half = document.createElement('canvas');
          half.width = Math.max(width, Math.round(src.width / 2));
          half.height = Math.max(height, Math.round(src.height / 2));
          const ctx = half.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(src, 0, 0, half.width, half.height);
          src = half;
        }
        return src.toDataURL(type, quality);
      },
      { svg, width, height, scale, type, quality }
    );
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  };
  try {
    return await fn(rasterize);
  } finally {
    await browser.close();
  }
}
