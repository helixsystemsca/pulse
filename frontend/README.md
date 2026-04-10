# Helix Systems — Marketing site (helixsystems.ca)

Standalone **Next.js** landing that showcases **Pulse**. This is **not** the Pulse web application; deploy it on **helixsystems.ca** (or www) and host the actual app on another host or subdomain.

## Pulse app URL

All “Login”, “Get Started”, “View Demo”, and “Launch Admin Panel” buttons use:

```bash
NEXT_PUBLIC_PULSE_APP_URL=https://your-pulse-app-host.example
```

Copy `.env.example` to `.env.local` for local dev. In production, set the same variable on Vercel / Netlify / your server.

Default in code (if unset): `https://app.helixsystems.ca` — change via env to match your real Pulse deployment.

## Commands

```bash
npm install
npm run dev
npm run build && npm start
```

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, `lucide-react`.

## Vercel

Set the Vercel project **Root Directory** to **`frontend`** when this app lives inside the Helix monorepo—or import the repo with root at this folder if you deploy only the web app. The project uses the App Router at `app/` and includes `public/` so Vercel detects **Next.js** (see `vercel.json`).
