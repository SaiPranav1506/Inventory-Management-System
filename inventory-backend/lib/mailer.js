const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
let usingEthereal = false;
let lastUsed = null; // 'primary' | 'secondary' | 'ethereal'

async function createTransportFromConfig(cfg) {
  return nodemailer.createTransport(cfg);
}

function buildConfigFromEnv(prefix) {
  // prefix can be '' (legacy) or 'PRIMARY' or 'SECONDARY'
  const host = process.env[`SMTP_HOST${prefix ? '_' + prefix : ''}`] || (prefix === '' ? process.env.SMTP_HOST : undefined);
  const user = process.env[`SMTP_USER${prefix ? '_' + prefix : ''}`] || (prefix === '' ? process.env.SMTP_USER : undefined);
  const pass = process.env[`SMTP_PASS${prefix ? '_' + prefix : ''}`] || (prefix === '' ? process.env.SMTP_PASS : undefined);
  const port = process.env[`SMTP_PORT${prefix ? '_' + prefix : ''}`] || (prefix === '' ? process.env.SMTP_PORT : undefined);
  const secure = process.env[`SMTP_SECURE${prefix ? '_' + prefix : ''}`] || (prefix === '' ? process.env.SMTP_SECURE : undefined);

  if (!host || !user || !pass) return null;

  return {
    host,
    port: parseInt(port || '587', 10),
    secure: String(secure || 'false') === 'true',
    auth: { user, pass }
  };
}

async function initMailer() {
  try {
    // Try primary config (preferred). Accept either SMTP_HOST_PRIMARY or legacy SMTP_HOST.
    const primaryCfg = buildConfigFromEnv('PRIMARY') || buildConfigFromEnv('') || null;
    if (primaryCfg) {
      try {
        transporter = await createTransportFromConfig(primaryCfg);
        // verify connection
        await transporter.verify();
        usingEthereal = false;
        lastUsed = 'primary';
        console.log('Mailer initialized with primary SMTP host', primaryCfg.host);
        return;
      } catch (err) {
        console.warn('Primary SMTP init failed:', err.message || err);
        transporter = null;
      }
    }

    // Try secondary config if provided
    const secondaryCfg = buildConfigFromEnv('SECONDARY');
    if (secondaryCfg) {
      try {
        transporter = await createTransportFromConfig(secondaryCfg);
        await transporter.verify();
        usingEthereal = false;
        lastUsed = 'secondary';
        console.log('Mailer initialized with secondary SMTP host', secondaryCfg.host);
        return;
      } catch (err) {
        console.warn('Secondary SMTP init failed:', err.message || err);
        transporter = null;
      }
    }

    // Fallback to Ethereal for dev
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    usingEthereal = true;
    lastUsed = 'ethereal';
    console.log('No working SMTP config found — using Ethereal test account for email (dev only).');
  } catch (err) {
    console.error('Failed to initialize mailer:', err);
    transporter = null;
  }
}

async function sendMail({ from, to, subject, text, html }) {
  if (!transporter) {
    throw new Error('Mailer not initialized');
  }

  const info = await transporter.sendMail({ from, to, subject, text, html });
  let previewUrl = null;
  if (usingEthereal) {
    previewUrl = nodemailer.getTestMessageUrl(info) || null;
  }
  return { info, previewUrl, provider: lastUsed };
}

module.exports = { initMailer, sendMail, usingEthereal: () => usingEthereal };
module.exports = { initMailer, sendMail, usingEthereal: () => usingEthereal, getLastUsed: () => lastUsed };
