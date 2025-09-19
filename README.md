[README.md](https://github.com/user-attachments/files/22419053/README.md)

# MPDC CRM – Webhook API (for Power Automate)

A tiny Express + Postgres webhook to receive **email events from Power Automate** and store them as **Contacts** and **Interactions**.

## What this does
- Exposes `POST /webhooks/email` expecting a JSON payload from Power Automate.
- Validates an `x-api-key` header.
- **Dedupes** on `message_id` to avoid double-inserts.
- Upserts a **Contact** (by email) and inserts an **Interaction** row.

## Run locally
```bash
cd mpdc-crm-webhook-api
cp .env.sample .env
# set DATABASE_URL and API_KEY
npm install
npm start
```
It listens on `http://localhost:8787` by default.

## Env vars
- `PORT=8787`
- `API_KEY=choose-a-long-random-string`
- `DATABASE_URL=postgres://user:pass@host:5432/mpdc_crm`

## Database
Run `db/schema.sql` on your Postgres. It creates minimal `contacts` and `interactions` tables and a **unique index** on `interactions.message_id` for dedupe.

## Expected payload (example from Power Automate)
```json
{
  "message_id": "<CAF123...@outlook.office365.com>",
  "direction": "email_in",
  "from": {"address": "jane@example.com", "name": "Jane Example"},
  "to": ["you@macpoint.com"],
  "cc": [],
  "subject": "Northern Access Road briefing",
  "received_at": "2025-09-19T01:22:33Z",
  "preview": "Thanks for the update...",
  "thread_id": "AAMkAD...",
  "attachments": []
}
```

> Tip: In Power Automate, use “When a new email arrives in a shared mailbox (V2)” for `communications@macpoint.com`, then an **HTTP** action to `POST` this JSON to `/webhooks/email`, and set the `x-api-key` header.

## Test with curl
```bash
curl -X POST http://localhost:8787/webhooks/email \
  -H 'content-type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "message_id":"<abc@id>",
    "direction":"email_in",
    "from":{"address":"jane@example.com","name":"Jane"},
    "to":["comm@macpoint.com"],
    "cc":[],
    "subject":"Test","received_at":"2025-09-19T00:00:00Z","preview":"hello"}'
```

## Notes on licensing
The **HTTP** action in Power Automate is a **premium** connector. If you don’t have premium, alternatives include:

1) Writing rows into an **Excel** or **SharePoint** list (standard) and letting this API poll an export endpoint later; or

2) Sending a structured **email** to an ingress service (e.g., Mailgun/SendGrid inbound parse) we host; or

3) Using **Power Automate per-flow** licensing for just this one flow.


For now, try the HTTP action; if it’s blocked, we’ll switch to option 1 temporarily.

