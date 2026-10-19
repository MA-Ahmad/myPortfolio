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
      }
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
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
