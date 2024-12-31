const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieSession({
  name: 'session',
  secret: process.env.COOKIE_SECRET || 'defaultsecret',
  maxAge: 24 * 60 * 60 * 1000, // 1 day? Might change to longer
}));

const DISCOURSE_URL = process.env.DISCOURSE_URL;
const SSO_SECRET = process.env.SSO_SECRET;
const RETURN_URL = process.env.RETURN_URL;
const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_TOKEN;

const subdomainDb = new sqlite3.Database('./subdomains.db');
const adminDb = new sqlite3.Database('./admin.db');

subdomainDb.run(`
  CREATE TABLE IF NOT EXISTS subdomains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    subdomain TEXT,
    domain TEXT,
    recordId TEXT
  )
`);
adminDb.run(`
  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT,
    zone_id TEXT
  )
`);

app.get('/login', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  req.session.nonce = nonce;

  const payload = Buffer.from(`nonce=${nonce}&return_sso_url=${RETURN_URL}`).toString('base64');
  const sig = crypto.createHmac('sha256', SSO_SECRET).update(payload).digest('hex');

  res.redirect(`${DISCOURSE_URL}/session/sso_provider?sso=${encodeURIComponent(payload)}&sig=${sig}`);
});

app.get('/auth/callback', (req, res) => {
  const { sso, sig } = req.query;

  const hmac = crypto.createHmac('sha256', SSO_SECRET).update(sso).digest('hex');
  if (hmac !== sig) {
    return res.status(400).send('Invalid signature.');
  }

  const decoded = Buffer.from(sso, 'base64').toString('utf8');
  const params = new URLSearchParams(decoded);
  const nonce = params.get('nonce');

  if (nonce !== req.session.nonce) {
    return res.status(400).send('Invalid nonce.');
  }

  req.session.user = {
    id: params.get('external_id'),
    username: params.get('username'),
    email: params.get('email'),
  };

  res.redirect(`http://localhost:3000`);
});

app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Unauthorized');
  }
  res.json(req.session.user);
});

app.get('/is-admin', (req, res) => {
  if (!req.session.user || req.session.user.username !== 'xmao') {
    return res.status(403).send('Forbidden');
  }
  res.json({ isAdmin: true });
});

app.post('/api/register-subdomain', async (req, res) => {
  const { userId, subdomain, domain } = req.body;

  if (!userId || !subdomain || !domain) {
    return res.status(400).json({ error: 'User ID, Subdomain, and Domain are required.' });
  }

  try {
    adminDb.get('SELECT zone_id FROM domains WHERE domain = ?', [domain], async (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: 'Invalid domain.' });
      }

      const zoneId = row.zone_id;

      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
        {
          type: 'A',
          name: subdomain,
          content: '127.0.0.1', //Just an example
        },
        {
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const recordId = response.data.result.id;

      subdomainDb.run(
        'INSERT INTO subdomains (userId, subdomain, domain, recordId) VALUES (?, ?, ?, ?)',
        [userId, subdomain, domain, recordId],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to save data to database.' });
          }
          res.json({ success: true, recordId });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.errors || error.message });
  }
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('http://localhost:3000');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
