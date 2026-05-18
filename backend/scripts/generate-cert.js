// One-shot self-signed certificate generator for the Hotel CRM HTTPS server.
// Run with: node scripts/generate-cert.js
// Produces certs/server.key and certs/server.crt (10-year validity).
// The cert carries SANs for every host we access the box on — internal LAN
// IP, Tailscale IP, machine hostname, and a placeholder internal domain.
// Re-running overwrites the existing files.

const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const attrs = [
  { name: 'commonName',         value: 'ewaa-hotel-crm' },
  { name: 'organizationName',   value: 'Ewaa Hotels' },
  { name: 'organizationalUnitName', value: 'CRM' },
  { name: 'countryName',        value: 'SA' },
];

const extensions = [
  { name: 'basicConstraints', cA: false },
  {
    name: 'keyUsage',
    keyCertSign: false,
    digitalSignature: true,
    keyEncipherment: true,
  },
  {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: false,
  },
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost'        },  // DNS
      { type: 2, value: 'AVAYA1'           },  // DNS — Windows hostname
      { type: 2, value: 'crm.ewaa.local'   },  // DNS — internal placeholder
      { type: 7, ip: '127.0.0.1'           },  // IP — loopback
      { type: 7, ip: '10.10.1.2'           },  // IP — LAN
      { type: 7, ip: '100.66.17.95'        },  // IP — Tailscale
    ],
  },
];

const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  days: 3650,           // 10 years
  algorithm: 'sha256',
  extensions,
});

fs.writeFileSync(path.join(outDir, 'server.key'), pems.private, { mode: 0o600 });
fs.writeFileSync(path.join(outDir, 'server.crt'), pems.cert,    { mode: 0o644 });

console.log('Generated:');
console.log('  ' + path.join(outDir, 'server.key'));
console.log('  ' + path.join(outDir, 'server.crt'));
console.log('Valid for 10 years. SANs: localhost, AVAYA1, crm.ewaa.local, 127.0.0.1, 10.10.1.2, 100.66.17.95');
