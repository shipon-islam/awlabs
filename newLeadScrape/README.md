# Person Report UI — Phase 1

This is the **Phase 1** implementation (UI skeleton) for the Person Report interface.

## What’s included
- Minimal HTML/CSS/JS
- Form fields: **Name**, **Company Name**, **LinkedIn URL (optional)**
- **Request ID** generation (UUID v4 with fallback)
- Basic validation & error messages
- Status card with **Request ID** and **payload preview**
- Loader overlay (simulated ACK in this phase)
- `localStorage` persistence & **Resume** banner
- No network calls yet (we simulate the immediate ACK)

## How to run
Just open `index.html` in a modern browser.  
For best results (and to avoid any clipboard/security quirks), serve it with a static server:

```bash
# Python 3
python -m http.server 8080

# or Node
npx serve .
```

Then visit: http://localhost:8080/person-report-ui/index.html

## Next phases
- **Phase 2:** Wire **Webhook 1** (n8n) and handle real ACK
- **Phase 3:** Storage wiring (already present in n8n)
- **Phase 4:** Wire **Webhook 2** (n8n) for status/fetch
- **Phase 5:** Implement the 2-minute wait + 30s polling until 6 minutes


---

## Phase 2 — Wire Webhook 1 (n8n)

1. Open `config.js` and set:
   - `WEBHOOK1_URL` to your n8n Workflow 1 webhook URL (Cloudflare Tunnel subdomain).
   - `CLIENT_KEY` if you validate a shared secret in the workflow (optional).

2. Serve the folder (required so the browser can load `config.js`):
```bash
python -m http.server 8080
# then visit http://localhost:8080/person-report-ui/index.html
```

3. Submit the form. You should see:
   - Status: “Submitting to Workflow 1…”
   - Then “ACK received from Workflow 1…” if the webhook returns 200.
   - If `WEBHOOK1_URL` is left blank, the app simulates an ACK so you can still test the UI.

**CORS:** Ensure your n8n webhook replies with:
```
Access-Control-Allow-Origin: http(s)://your-ui-origin
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Client-Key
```
(Handle preflight by allowing `OPTIONS` in the webhook route if needed.)


---

## Phase 4 — Wire Webhook 2 (n8n Status/Fetch)
1. Open `config.js` and set `WEBHOOK2_URL` to your Workflow-2 webhook URL.
2. Ensure Workflow-2 returns:
   - **200** with `{ requestId, status: "complete", data: {...} }` when ready
   - **400** (or **202**) with `{ status: "processing" }` while still running
   - **404** with `{ status: "not_found" }` for missing/expired IDs
   - **500** with `{ status: "error", errorMessage }` on internal errors
3. Confirm CORS headers as in Phase 2.

## Phase 5 — Timing & Polling
- After a successful ACK from Workflow-1, the app:
  - Waits **2 minutes** (`WAIT_BEFORE_POLL_MS`)
  - Polls every **30 seconds** (`POLL_INTERVAL_MS`)
  - Times out at **6 minutes** total (`TIMEOUT_MS`)
- You can customize these in `config.js`.
- If timed out, a **Check Again** button appears to query once more manually.
