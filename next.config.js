/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Blog covers come from Dev.to; keep this list in step with lib/cover-image.ts.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'dev-to-uploads.s3.amazonaws.com', pathname: '/uploads/**' },
      { protocol: 'https', hostname: 'media.dev.to', pathname: '/**' },
      { protocol: 'https', hostname: 'media2.dev.to', pathname: '/**' }
    ]
  },
  // Inlined at build time so the page view calls in lib/gtag.js can read it in the browser.
  env: { GA_TRACKING_ID: process.env.GA_TRACKING_ID ?? '' },
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty-module.js' },
      net: { browser: './empty-module.js' },
      tls: { browser: './empty-module.js' },
      child_process: { browser: './empty-module.js' }
    }
  },
  async headers() {
    return [
      // The home page answers Markdown or HTML by Accept header, so caches must keep them apart.
      { source: '/', headers: [{ key: 'Vary', value: 'Accept' }] }
    ];
  },
  async redirects() {
    return [
      {
        source: '/llms-full.txt',
        destination: '/llms.txt',
        permanent: true
      },
      {
        source: '/terminal',
        destination: '/themes/terminal',
        permanent: true
      },
      {
        source: '/canvas',
        destination: '/theme-studio',
        permanent: true
      },
      // Pages removed in October 2026 whose content now lives on the home page.
      ...['/about', '/projects', '/tech-stack', '/open-source', '/developer-story'].map(
        (source) => ({ source, destination: '/', permanent: true })
      )
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/sitemap.xml',
          destination: '/api/sitemap'
        },
        {
          source: '/llms.txt',
          destination: '/api/agents/llms'
        },
        {
          source: '/index.md',
          destination: '/api/agents/llms'
        },
        {
          source: '/about.md',
          destination: '/api/agents/about'
        },
        {
          source: '/experience.md',
          destination: '/api/agents/experience'
        },
        {
          source: '/education.md',
          destination: '/api/agents/education'
        },
        {
          source: '/projects.md',
          destination: '/api/agents/projects'
        },
        {
          source: '/blocks/:name([a-z0-9-]+).md',
          destination: '/api/agents/blocks/:name'
        },
        {
          source: '/r/:name([a-z0-9-]+).json',
          destination: '/api/registry/:name'
        },
        {
          source: '/',
          destination: '/api/agents/llms',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)'
            }
          ]
        }
      ],
      // Agents asking for Markdown get a Markdown 404 instead of the HTML error page. Fallback
      // rewrites only run once no page, file or dynamic route matched.
      fallback: [
        {
          source: '/:path*',
          destination: '/api/agents/not-found?path=:path*',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)'
            }
          ]
        }
      ]
    };
  }
};

module.exports = nextConfig;
