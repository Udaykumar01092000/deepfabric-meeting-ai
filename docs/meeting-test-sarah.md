# Test Meeting: Inbox Filtering (Sarah)

Date: 2026-07-06

Purpose: Create a reproducible meeting that assigns an action item to Sarah so we can verify the Inbox filters correctly by selected user.

---

## Meeting payload (POST /api/meetings)

```json
{
  "title": "Test Meeting for Inbox",
  "dateTime": "2026-07-07T10:00:00.000Z",
  "organizer": "Rahul",
  "participants": ["Sarah (Backend Developer)", "Rahul"],
  "rawContent": "Transcript:\nRahul: We need to ship the auth API.\nSarah (Backend Developer): I will finish the authentication APIs by Friday.\nRahul: Great, assign that to Sarah.\n"
}
```

Notes:
- The `rawContent` contains a line that should be extracted as an action item assigned to `Sarah (Backend Developer)`.

---

## Expected action items created (examples)

- Finish the authentication APIs by Friday — owner: Sarah (Backend Developer) — status: open — due: (extracted by processor)

---

## Verification steps (run when backend is reachable)

1) Create the meeting (example with curl):

```bash
curl -X POST "http://localhost:5000/api/meetings" \
  -H "Content-Type: application/json" \
  -d '@meeting-payload.json'
```

(Or use the JSON above directly with your preferred HTTP client.)

2) Wait for the extraction run / background job to produce action items (may be immediate or a few seconds).

3) Fetch the inbox for Sarah:

```bash
curl "http://localhost:5000/api/action-items/inbox?owner=Sarah"
```

Replace `Sarah` with the exact display name you use in the UI (e.g. `Sarah (Backend Developer)` or `Sarah`) — the backend matcher tolerates variants.

4) Expected: The response JSON should include the action item assigned to Sarah under `allMyItems` and `dueThisWeek` (or other relevant bucket).

---

## If creation fails (diagnosis notes)

- The backend must be able to connect to the configured MySQL host. If you see errors like `getaddrinfo ENOTFOUND mysql-...`, the database is unreachable and creation will fail.
- To test locally without the remote DB, update `.env` or run a local MySQL instance and set `DB_HOST=localhost`, `DB_USER` etc., then restart the backend.

---

## What I did now

- Attempted to create the meeting via the running backend; the POST failed because the backend currently cannot create new meetings (DB DNS/connection failure). I left this payload and verification steps here so you can run them once the DB is reachable.


---

File: [docs/meeting-test-sarah.md](docs/meeting-test-sarah.md)
