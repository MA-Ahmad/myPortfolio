/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty-module.js' },
      net: { browser: './empty-module.js' },
      tls: { browser: './empty-module.js' },
      child_process: { browser: './empty-module.js' }
    }
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
  // The block Markdown and registry routes read their source files from disk at request time.
  outputFileTracingIncludes: {
    '/api/agents/blocks/*': ['./blocks/**/*'],
    '/api/registry/*': ['./blocks/**/*']
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
      ]
    };
  }
};

module.exports = nextConfig;
