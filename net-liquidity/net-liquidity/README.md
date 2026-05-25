# Fed Net Liquidity Monitor

Tracks **Net Liquidity = Fed Assets − Treasury General Account (TGA) − Reverse Repo (RRP)** vs the S&P 500, with a 3-year lookback and automatic weekly updates.

## Data Sources (all free)

| Series | Source | Frequency |
|--------|--------|-----------|
| Fed Total Assets (WALCL) | FRED | Weekly (Wed) |
| Treasury General Account (WTREGEN) | FRED | Weekly (Wed) |
| Overnight Reverse Repo (RRPONTSYD) | FRED | Daily |
| S&P 500 | Yahoo Finance | Daily |

---

## Setup Steps

### 1. Get a free FRED API key
1. Go to https://fred.stlouisfed.org/docs/api/api_key.html
2. Create a free account and request an API key
3. Copy the key

### 2. Create an Upstash Redis database
1. Go to https://upstash.com and sign up (free)
2. Create a new Redis database (select the region closest to you)
3. Copy the **REST URL** and **REST Token** from the dashboard

### 3. Create the GitHub repo and push code
```bash
cd net-liquidity
git init
git add .
git commit -m "Initial commit"
gh repo create net-liquidity --public --push
```

### 4. Deploy to Vercel
1. Go to https://vercel.com and import your GitHub repo
2. Add these environment variables in Vercel settings:
   - `FRED_API_KEY` — from step 1
   - `UPSTASH_REDIS_REST_URL` — from step 2
   - `UPSTASH_REDIS_REST_TOKEN` — from step 2
   - `SEED_SECRET` — any random string (e.g. `mysecret123`)
3. Deploy

### 5. Seed historical data (one-time)
Once deployed, visit:
```
https://your-app.vercel.app/api/seed?secret=YOUR_SEED_SECRET
```
This loads 3 years of historical data. Takes ~15 seconds. You'll see:
```json
{ "success": true, "count": 156, "startDate": "2023-05-24", "endDate": "2026-05-21" }
```

### 6. Automatic updates
The `vercel.json` cron job runs every **Thursday at 11pm UTC** (after the Wednesday FRED data release). Vercel handles authentication automatically via `CRON_SECRET`.

---

## Running Locally

```bash
npm install
cp .env.example .env.local
# Fill in your env vars in .env.local
npm run dev
```

Visit http://localhost:3000
