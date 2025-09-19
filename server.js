
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!API_KEY) {
  console.error('Missing API_KEY in .env'); process.exit(1);
}
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env'); process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const pool = new Pool({ connectionString: DATABASE_URL });

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'Payload missing';
  if (!payload.message_id) return 'message_id is required';
  if (!payload.from || !payload.from.address) return 'from.address is required';
  if (!payload.received_at) return 'received_at is required';
  return null;
}

async function upsertContactByEmail(client, email, name) {
  const q = await client.query('SELECT id FROM contacts WHERE lower(email)=lower($1)', [email]);
  if (q.rows.length) return q.rows[0].id;
  const parts = (name || '').split(' ');
  const first = parts.slice(0, -1).join(' ') || null;
  const last = parts.slice(-1).join(' ') || null;
  const ins = await client.query(
    'INSERT INTO contacts (first_name, last_name, email) VALUES ($1,$2,$3) RETURNING id',
    [first, last, email]
  );
  return ins.rows[0].id;
}

app.post('/webhooks/email', async (req, res) => {
  if (req.get('x-api-key') !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    message_id, direction = 'email_in', from, to = [], cc = [], subject = '',
    received_at, preview = '', thread_id = null, attachments = []
  } = req.body;

  // Normalize occurred_at (ISO string)
  const occurred_at = new Date(received_at).toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Dedup on message_id
    const dupe = await client.query('SELECT id FROM interactions WHERE message_id=$1', [message_id]);
    if (dupe.rows.length) {
      await client.query('COMMIT');
      return res.json({ ok: true, deduped: true, id: dupe.rows[0].id });
    }

    const contactId = await upsertContactByEmail(client, from.address, from.name);

    const ins = await client.query(
      `INSERT INTO interactions (contact_id, type, occurred_at, subject, summary, source, message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [contactId, direction, occurred_at, subject, preview, 'power_automate', message_id]
    );

    await client.query('COMMIT');
    return res.json({ ok: true, id: ins.rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Insert error:', e);
    return res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Webhook listening on http://localhost:${PORT}`);
});
