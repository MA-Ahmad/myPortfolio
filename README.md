# Muhammad Ahmad — Portfolio

A modern, agent-friendly portfolio built with **Next.js 14 (App Router)** and **Tailwind CSS**. Visual design inspired by [chanhdai.com](https://chanhdai.com/).

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Edit Content

All content lives in **one file**: [`content/site.ts`](./content/site.ts).

### Update Personal Info

Edit the `siteConfig` object:

```ts
export const siteConfig = {
  name: "Your Name",
  role: "Your Role",
  location: "Your Location",
  bio: "Your bio here...",
  avatarUrl: "https://...", // or local path like "/avatar.jpg"
  socials: [...],
  github: { username: "your-github-username" },
};
```

### Update Work History

Edit the `workHistory` array. Each job has:

- `company` — Company name
- `role` — Your job title
- `period` — e.g., "2023 – Present"
- `skills` — Array of technologies
- `logo` — Optional path to logo in `/public/assets/images/logos/`

### Update Projects

Edit the `projects` array. Each project has:

- `title` — Project name
- `description` — One-line description
- `techStack` — Array of technologies
- `site` — URL to live project
- `github` — Optional GitHub repo URL
- `image` — Optional cover image path in `/public/assets/images/projects/cover/`

## Contribution Graphs

### GitHub Graph

Fetches live data from the GitHub contributions API for the username in `siteConfig.github.username`. Data is cached and revalidated daily.

No API token required for public profiles. If you need authenticated access, set `GITHUB_TOKEN` in your environment.

### Cursor Graph

The Cursor contribution graph uses the same visual component but sources data from [`content/cursor-contributions.json`](./content/cursor-contributions.json).

To populate it, add entries to the `contributions` array:

```json
{
  "contributions": [
    { "date": "2024-01-15", "count": 5 },
    { "date": "2024-01-16", "count": 12 }
  ]
}
```

If you have access to a Cursor API endpoint in the future, you can set `NEXT_PUBLIC_CURSOR_API_URL` and modify the data fetcher.

## Project Structure

```
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Root layout with fonts/providers
│   ├── page.tsx          # Homepage
│   └── globals.css       # Tailwind + design tokens
├── components/           # React components
├── content/              # Content data (edit this!)
│   ├── site.ts           # All site content
│   └── cursor-contributions.json
├── lib/                  # Utilities
└── public/               # Static assets
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Fonts**: Geist Sans, Geist Mono, Caveat (handwritten)
- **Theme**: Light/dark mode via next-themes

## License

MIT
