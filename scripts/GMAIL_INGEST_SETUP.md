# Invoice-ingest from sales@freshnfruityghd.com — one-time setup (IMAP)

This replaces the Postmark inbound webhook. The poller (`scripts/imap-ingest.mjs`) reads
supplier invoices straight from **sales@freshnfruityghd.com** over IMAP and feeds the
existing `/api/delivery-note` webhook — so parsing/costing/price-suggestions are unchanged.
No more 100-email cap, no more silent drops.

## Why IMAP (and not a Google service account)

The original plan used a Google service-account key with domain-wide delegation. Google now
enforces `iam.disableServiceAccountKeyCreation` as a **Secure-by-Default** constraint — even
on org-less personal Cloud projects — so a service-account JSON key **cannot be created** on
the `jeseraimonpatron@gmail.com` account, and there's no organization node anywhere to turn
the policy off. IMAP + an app password avoids Google Cloud entirely.

## What YOU do (~10 min — needs Workspace admin + access to the sales@ account)

### 1. Enable IMAP for the mailbox (Workspace Admin console — admin.google.com)
1. **Apps → Google Workspace → Gmail → End User Access.**
2. Make sure **IMAP access** is **ON** (for the OU that contains sales@, or everyone).

### 2. Turn on 2-Step Verification for sales@ (required before app passwords exist)
1. Sign in as **sales@freshnfruityghd.com** → myaccount.google.com → **Security**.
2. Turn on **2-Step Verification**.
   - If the admin policy blocks app passwords, allow them: Admin console →
     **Security → Authentication → 2-step verification → "Allow users to turn on app passwords."**

### 3. Generate an app password (as sales@)
1. Still in the sales@ account: **Security → 2-Step Verification → App passwords**
   (or go to myaccount.google.com/apppasswords).
2. App name: `fresh-invoice-ingest`. **Create.**
3. Copy the **16-character** password it shows (it's displayed once). Spaces don't matter —
   the poller strips them.

### 4. Hand me the app password
Paste it to me (or drop it on the server) and I'll put it in `.env.local`. It only grants
mail access to this one mailbox and can be revoked any time from the same App passwords page.

## What I do (once I have the app password)
1. Add to `.env.local`:
   ```
   GMAIL_INGEST_USER=sales@freshnfruityghd.com
   GMAIL_INGEST_APP_PASSWORD=xxxxxxxxxxxxxxxx
   ```
   (`POSTMARK_WEBHOOK_SECRET` is already set; the webhook token is unchanged.)
2. Dry-run to confirm it sees the right emails, changing nothing:
   ```
   node scripts/imap-ingest.mjs --dry-run
   ```
3. Live sweep — widen the window to catch the 7 dropped on 29 Jun, then backfill:
   ```
   node scripts/imap-ingest.mjs --since 7d
   ```
4. Schedule it (cron, every 15 min — invoices land all morning):
   ```
   */15 * * * * cd /root/fresh/fresh-and-fruity && /usr/bin/node scripts/imap-ingest.mjs >> /root/fresh/logs/gmail-ingest.log 2>&1
   ```

## How it stays safe / idempotent
- Each processed message's RFC822 Message-ID is recorded in `scripts/.imap-ingest-state.json`
  (gitignored); already-seen messages are skipped.
- The webhook's own dedup (same supplier+date+items → skip; same ticket → keep fuller copy)
  makes any re-feed harmless even if that state file is lost.
- Only the automated supplier senders are ingested (Total Produce / JR Holland / Thomas Baty
  / The Milk Company); statements and collection notices are excluded.

## Then turn Postmark off
Once a few cron runs look clean, remove the Gmail→Postmark forwarding rule and downgrade/
close the Postmark account. The mailbox is the source of truth; Postmark is no longer in the
loop.

---
*Superseded: `scripts/gmail-ingest.mjs` (service-account/DWD version) is kept for reference
only — it can't be used until SA-key creation is possible on this account.*
