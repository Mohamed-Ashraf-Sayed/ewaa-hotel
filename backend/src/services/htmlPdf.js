// Single shared headless-Chromium instance for HTML → PDF rendering.
// Launching Chrome per request would burn ~500ms and a lot of RAM; we keep
// the browser alive across requests and just open/close pages.

let _browserPromise = null;

const launchOpts = () => ({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
});

const getBrowser = async () => {
  if (_browserPromise) {
    const b = await _browserPromise;
    if (b.connected !== false) return b;
    _browserPromise = null;
  }
  const puppeteer = require('puppeteer');
  _browserPromise = puppeteer.launch(launchOpts());
  const b = await _browserPromise;
  // Re-init if the browser ever crashes.
  b.on('disconnected', () => { _browserPromise = null; });
  return b;
};

// Render HTML to a PDF Buffer using a one-shot Chromium page.
const htmlToPdf = async (html, opts = {}) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: opts.format || 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: opts.margin || undefined,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => null);
  }
};

module.exports = { htmlToPdf };
