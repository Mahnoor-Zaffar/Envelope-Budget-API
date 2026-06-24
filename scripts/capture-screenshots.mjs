import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'screenshots');
const url = process.argv[2] || 'http://localhost:3000';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'dashboard.png') });

await page.click('[data-view="envelopes"]');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'envelopes.png') });

await browser.close();
console.log('Saved screenshots to', outDir);
