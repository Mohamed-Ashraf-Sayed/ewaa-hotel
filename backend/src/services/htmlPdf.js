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

// Render HTML to a PDF Buffer using a one-shot Chromium page. If a
// `footerHtml` is supplied the renderer enables displayHeaderFooter and
// repeats it on every page (Puppeteer's footerTemplate path), reserving
// `footerHeightMm` of bottom margin so the page body doesn't overlap it.
const htmlToPdf = async (html, opts = {}) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfOpts = {
      format: opts.format || 'A4',
      printBackground: true,
    };
    if (opts.footerHtml) {
      pdfOpts.displayHeaderFooter = true;
      pdfOpts.headerTemplate = '<div></div>';
      pdfOpts.footerTemplate = opts.footerHtml;
      // Override CSS page size — Puppeteer ignores margin when
      // preferCSSPageSize is true, but we need explicit margins to make
      // room for the per-page footer (24mm banner + a few mm spacing).
      pdfOpts.margin = opts.margin || {
        top: '16mm', right: '14mm', bottom: '32mm', left: '14mm',
      };
    } else {
      pdfOpts.preferCSSPageSize = true;
      if (opts.margin) pdfOpts.margin = opts.margin;
    }
    const pdf = await page.pdf(pdfOpts);
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => null);
  }
};

module.exports = { htmlToPdf };
