# SunTech Nordic Landing Funnel (Next.js)

Redesigned landing + lead funnel. Submissions go to the existing LeadConnector / GHL webhook. **Do not overwrite** the live `suntech-battery-funnel` Vercel project — import this folder as a new project.

## Deploy on Vercel

1. Import this folder as a **new** Vercel project
2. Optional env var: `LEADS_WEBHOOK_URL` (defaults to the production GHL webhook)
3. Owner email:
   - `MAILGUN_API_KEY`
   - `OWNER_NOTIFICATION_EMAIL`

4. Preview on the new `*.vercel.app` URL first
5. Later: attach `suntechnordic.censio.dk` to this project and unpublish the old funnel

## Local dev

```bash
npm install
npm run dev
```

Pixel ID, webhook URL, and step firing (GHL every step, Facebook `Lead` only after step 4) match the live funnel.
