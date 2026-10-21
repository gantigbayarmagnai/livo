# Putting Livo online at app.getlivo.org

About 30 minutes, mostly waiting. You need: a card for Render, and access to Cloudflare (where getlivo.org lives).

Livo runs on **Render**: one web service (the app) and one PostgreSQL database, both in Render's Oregon region. Every push to `main` on GitHub redeploys automatically, and database updates apply on their own when it starts.

---

## 1. Create the Render account

1. Go to **render.com** and choose **Sign up with GitHub** (use the account that owns `gantigbayarmagnai/livo`).
2. When Render asks for GitHub access, allow it for the **livo** repository.
3. Add a payment card under **Account settings → Billing**.

## 2. Create Livo from the blueprint

1. In the Render dashboard, click **New → Blueprint**.
2. Pick the **livo** repository. Render reads `render.yaml` and shows two resources:
   - **livo** (web service, Starter)
   - **livo-db** (PostgreSQL, Basic 256 MB)
3. Click **Apply** (or **Deploy Blueprint**). The first build takes about 5–10 minutes.
4. When the **livo** service shows **Live**, it has an address like `https://livo-abcd.onrender.com`. Note it; you need it in step 4.

## 3. Create your owner account (do this right away)

1. In Render, open the **livo** service → **Environment** and copy the value of **LIVO_SETUP_CODE**.
2. Open the `onrender.com` address. You'll see **Set up Livo**.
3. Fill in:
   - **Setup code**: the value you just copied
   - Your name, your real email, and a strong password (10+ characters)
   - **Next confirmation number**: the next conf # from Limo Anywhere, so numbers carry on
   - Leave **Start with MGL's 2026 rate card, trip statuses and fleet units** checked
4. Click **Create owner account**. You're now the owner, and setup closes for good.

The setup code means nobody else can claim the owner account, even if they find the address first.

## 4. Point app.getlivo.org at Livo

Do these in order, Render first.

**In Render**
1. **livo** service → **Settings → Custom Domains → Add Custom Domain**.
2. Enter `app.getlivo.org` and save. Render shows it as waiting for DNS.

**In Cloudflare** (dash.cloudflare.com → getlivo.org)
1. **SSL/TLS → Overview** → set encryption mode to **Full**.
2. **DNS → Records**: if there's an `AAAA` record for `app`, delete it.
3. **Add record**:
   - **Type:** CNAME
   - **Name:** `app`
   - **Target:** your Render address without `https://`, e.g. `livo-abcd.onrender.com`
   - **Proxy status:** **DNS only** (grey cloud)
4. Save.

**Back in Render**, wait until `app.getlivo.org` shows **Verified** and the certificate is **issued** (usually a few minutes; click **Verify** to recheck). Then open **https://app.getlivo.org**.

Optional, after the certificate is issued: switch the Cloudflare record to **Proxied** (orange cloud) for Cloudflare's protection.

## 5. Add your team

Sign in at app.getlivo.org → **My Office → Team → Add someone**.

- **Dispatchers** get reservations, dispatch, calendar, accounts and schedules.
- **Chauffeurs** must be linked to their chauffeur record. Add them first under **My Office → Chauffeurs**.
- Each person gets a one-time temporary password; pass it on in person or by text. They choose their own at first sign-in.

---

## Day-to-day

- **Updates:** whenever new work is pushed to GitHub `main`, Render rebuilds and switches over automatically.
- **Health:** Render checks `/api/health` and won't switch to a new version that can't reach the database.
- **Backups:** check the **livo-db → Backups / Recovery** page in Render for what your plan includes. Upgrade the database plan before real volume builds up.
- **Settings:** company name and time zone are `LIVO_COMPANY_NAME` and `LIVO_COMPANY_TZ` in the service's Environment tab.
- **Never** run `npm run db:seed` against the live database. It refuses in production unless forced, because it erases everything.

## Moving to AWS later

The app ships as a standard Docker container (`Dockerfile`) on standard PostgreSQL 16, with nothing Render-specific inside. Moving is: copy the database (`pg_dump` / `pg_restore`), run the same container on AWS (for example ECS Fargate with RDS Postgres), set the same environment variables, and point `app.getlivo.org` at the new address.
