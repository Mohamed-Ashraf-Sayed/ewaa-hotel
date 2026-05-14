// wkhtmltopdf-based HTML → PDF fallback for environments where headless
// Chromium can't run (e.g. the internal Windows Server 2012 R2 box). Spawns
// the wkhtmltopdf binary, pipes the HTML in via a temp file, reads back
// the PDF bytes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const candidateBinaries = () => {
  if (process.env.WKHTMLTOPDF_PATH) return [process.env.WKHTMLTOPDF_PATH];
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
      'C:\\Program Files (x86)\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
      'wkhtmltopdf.exe',
    ];
  }
  return ['/usr/local/bin/wkhtmltopdf', '/usr/bin/wkhtmltopdf', 'wkhtmltopdf'];
};

let _binary = null;
const findBinary = () => {
  if (_binary !== null) return _binary;
  for (const c of candidateBinaries()) {
    try {
      if (path.isAbsolute(c) && fs.existsSync(c)) { _binary = c; return _binary; }
      // bare name → leave it to PATH lookup at spawn time
      if (!path.isAbsolute(c)) { _binary = c; return _binary; }
    } catch (_) { /* skip */ }
  }
  _binary = null;
  return null;
};

const isAvailable = () => !!findBinary();

const htmlToPdf = (html, opts = {}) => new Promise((resolve, reject) => {
  const bin = findBinary();
  if (!bin) return reject(new Error('wkhtmltopdf binary not found'));

  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const htmlPath   = path.join(tmpDir, `wkpdf-${id}.html`);
  const pdfPath    = path.join(tmpDir, `wkpdf-${id}.pdf`);
  const footerPath = opts.footerHtml ? path.join(tmpDir, `wkpdf-${id}-footer.html`) : null;
  fs.writeFileSync(htmlPath, html, 'utf8');
  if (footerPath) fs.writeFileSync(footerPath, opts.footerHtml, 'utf8');

  // When we're rendering a footer, reserve extra bottom margin for it
  // (24mm footer banner + spacing).
  const marginBottom = opts.footerHtml
    ? (opts.marginBottom || '32mm')
    : (opts.marginBottom || '22mm');

  const args = [
    '--quiet',
    '--encoding', 'utf-8',
    '--enable-local-file-access',
    '--load-error-handling', 'ignore',
    '--load-media-error-handling', 'ignore',
    '--javascript-delay', String(opts.jsDelayMs || 800),
    '--page-size', opts.pageSize || 'A4',
    '--margin-top', opts.marginTop || '16mm',
    '--margin-right', opts.marginRight || '14mm',
    '--margin-bottom', marginBottom,
    '--margin-left', opts.marginLeft || '14mm',
  ];
  if (footerPath) {
    args.push('--footer-html', footerPath);
    args.push('--footer-spacing', '2');
  }
  args.push(htmlPath, pdfPath);

  const child = spawn(bin, args, { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('error', (err) => {
    cleanup();
    reject(err);
  });
  child.on('close', (code) => {
    if (code !== 0 && !(code === 1 && fs.existsSync(pdfPath))) {
      cleanup();
      return reject(new Error(`wkhtmltopdf exited ${code}: ${stderr.slice(0, 500)}`));
    }
    try {
      const buf = fs.readFileSync(pdfPath);
      cleanup();
      resolve(buf);
    } catch (e) {
      cleanup();
      reject(e);
    }
  });

  function cleanup() {
    try { fs.unlinkSync(htmlPath); } catch (_) {}
    try { fs.unlinkSync(pdfPath); } catch (_) {}
    if (footerPath) { try { fs.unlinkSync(footerPath); } catch (_) {} }
  }
});

module.exports = { htmlToPdf, isAvailable };
