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

  // Write the HTML to a temp file. Some wkhtmltopdf builds have quirks with
  // stdin-piped HTML when CSS uses @import (Google Fonts), so a real file
  // url is more reliable.
  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const htmlPath = path.join(tmpDir, `wkpdf-${id}.html`);
  const pdfPath  = path.join(tmpDir, `wkpdf-${id}.pdf`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const args = [
    '--quiet',
    '--encoding', 'utf-8',
    '--enable-local-file-access',
    '--load-error-handling', 'ignore',
    '--load-media-error-handling', 'ignore',
    '--javascript-delay', String(opts.jsDelayMs || 800),
    '--page-size', opts.pageSize || 'A4',
    '--margin-top', opts.marginTop || '18mm',
    '--margin-right', opts.marginRight || '16mm',
    '--margin-bottom', opts.marginBottom || '22mm',
    '--margin-left', opts.marginLeft || '16mm',
    htmlPath,
    pdfPath,
  ];

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
  }
});

module.exports = { htmlToPdf, isAvailable };
