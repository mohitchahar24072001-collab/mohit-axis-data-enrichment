# Data Enrichment App

A professional web application that takes contact records (CSV) and enriches them with current employment information using AI-powered web search and Google Gemini AI analysis.

## What It Does

1. **Import** — Upload a CSV file with up to ~5,000 contacts (name, email, company, title, location)
2. **Search** — For each contact, runs targeted Google searches to find their LinkedIn profile and current employer
3. **Enrich** — Uses Google Gemini AI to intelligently parse search results and extract:
   - Current company name
   - Current job title
   - LinkedIn profile URL
   - Confidence score (0-100%)
4. **Export** — Download the enriched dataset as a new CSV file

## Tech Stack

- **Next.js 15** (App Router, standalone output) — Full-stack React framework
- **Tailwind CSS** — Utility-first styling
- **JSON file storage** — No external database required; data lives in `/data`
- **PapaParse** — CSV parsing in the browser
- **Google Generative AI SDK** — Gemini AI for intelligent data extraction
- **Google Custom Search API** — Web search

---

## Local Development

### 1. Install Dependencies

```bash
cd data-enrichment-app
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
GOOGLE_CUSTOM_SEARCH_API_KEY=your_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_cx_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

#### Getting API Keys

**Google Custom Search API**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the "Custom Search API"
4. Go to Credentials → Create API Key

**Google Custom Search Engine ID**
1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com)
2. Click "Add", select "Search the entire web"
3. Copy the "Search engine ID" (cx value)

**Anthropic API Key**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys → Create new key

### 3. Run in Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run in Production Mode Locally

```bash
npm run build
npm start
```

### 5. Run Permanently with PM2 (stays alive after terminal closes)

```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
pm2 save          # persist across reboots
pm2 startup       # follow the printed command to enable on boot
```

To stop: `pm2 stop mohit-axis`
To view logs: `pm2 logs mohit-axis`

---

## Railway Deployment

### Prerequisites

- A [Railway](https://railway.app) account (free tier works)
- A GitHub account
- Your project pushed to a GitHub repository

### Step 1: Push to GitHub

```bash
cd data-enrichment-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> Note: `.env.local` and `data/*.json` are gitignored — never commit secrets.

### Step 2: Create a Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account
5. Select your repository from the list

### Step 3: Set Environment Variables

In your Railway project dashboard:

1. Click on your service
2. Go to the **Variables** tab
3. Add the following variables one by one:

| Variable | Value |
|----------|-------|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Your Google API key |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | Your CX value |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `DATA_DIR` | `/app/data` |

> `DATA_DIR` tells the app to store data in the mounted volume at `/app/data`.

### Step 4: Add a Persistent Volume

The app stores contacts in JSON files. To persist data across deploys:

1. In your Railway service, go to the **Volumes** tab
2. Click **Add Volume**
3. Set the mount path to `/app/data`
4. Click **Create**

> Without a volume, data is wiped on each deploy. The `railway.toml` already configures this.

### Step 5: Deploy

Railway will automatically build and deploy when you push to your GitHub repo. The `railway.toml` in the project root configures:

- **Builder**: Nixpacks (auto-detects Node.js)
- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Health check**: `GET /api/stats` (must return 200 for Railway to consider the deploy healthy)
- **Restart policy**: Restarts automatically on failure (up to 10 times)

### Step 6: Access Your App

1. In the Railway dashboard, click your service
2. Go to the **Settings** tab → **Networking**
3. Click **Generate Domain** to get a public URL
4. Or add your own custom domain

### Monitoring Deploys

- **Logs**: Click your service → **Logs** tab
- **Health**: Railway pings `/api/stats` every 30 seconds
- **Metrics**: CPU/memory visible in the **Metrics** tab

---

## Docker Deployment (Alternative)

A `Dockerfile` is included for self-hosted or non-Railway deployments:

```bash
docker build -t data-enrichment-app .
docker run -p 3000:3000 \
  -e GOOGLE_CUSTOM_SEARCH_API_KEY=your_key \
  -e GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_cx \
  -e ANTHROPIC_API_KEY=your_key \
  -e DATA_DIR=/app/data \
  -v $(pwd)/data:/app/data \
  data-enrichment-app
```

---

## How to Use the App

### Step 1: Prepare Your CSV

Minimum columns required:
- First Name
- Last Name

Ideally also include: Email, Company, Job Title, City, Country

### Step 2: Import Contacts

1. Click **Import** in the sidebar
2. Drag & drop your CSV file
3. Verify auto-detected column mappings
4. Preview the first 5 rows
5. Click **Import X Contacts**

### Step 3: Start Enrichment

From the Dashboard, click **Start Enrichment** to process all pending contacts. The app processes 1 contact every 2 seconds to respect API rate limits.

### Step 4: Export Results

Click **Export CSV** on the Contacts page to download the enriched dataset.

---

## Status Reference

| Status | Meaning |
|--------|---------|
| Pending | Not yet processed |
| Enriching | Currently being processed |
| Enriched | Successfully found current info |
| Failed | Search or parse error |

## Confidence Scores

| Score | Meaning |
|-------|---------|
| 90-100% | Found LinkedIn profile with clear current position |
| 70-89% | Strong indicators from multiple reliable sources |
| 50-69% | Some evidence but not fully confirmed |
| 30-49% | Weak evidence, possible match |
| 0-29% | Very uncertain or no relevant info found |

---

## Data Storage

Contact data is stored as JSON files in the `data/` directory:
- `data/contacts.json` — all contact records
- `data/activity.json` — activity log (last 500 entries)

To reset all data, delete the JSON files and restart the app. In production on Railway, the volume at `/app/data` persists these files across deploys.

## Troubleshooting

**"No search provider configured"** — Add `GOOGLE_CUSTOM_SEARCH_API_KEY` and `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` to your environment variables.

**Data lost after Railway deploy** — Make sure you added a Volume with mount path `/app/data` and set `DATA_DIR=/app/data`.

**App not starting on Railway** — Check the Logs tab. Make sure all required environment variables are set.

**Low confidence scores** — Common for names with limited web presence. Adding more identifying info (company, location) to your CSV improves results.
