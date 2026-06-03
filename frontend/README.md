# Helix Systems — Marketing site (helixsystems.ca)

Standalone **Next.js** landing that showcases **Helix**. This is **not** the Helix web application; deploy it on **helixsystems.ca** (or www) and host the actual app on another host or subdomain.

## Helix app URL

All “Login”, “Get Started”, “View Demo”, and “Launch Admin Panel” buttons use:

```bash
NEXT_PUBLIC_PULSE_APP_URL=https://your-pulse-app-host.example
```

Copy `.env.example` to `.env.local` for local dev. In production, set the same variable on Vercel / Netlify / your server.

Default in code: `https://panorama.helixsystems.ca` (dev without env: `http://localhost:3000`). Set `NEXT_PUBLIC_PULSE_APP_URL` on the marketing deploy (Vercel, etc.); legacy `pulse.helixsystems.ca` in that env is rewritten to panorama for CTAs.

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
