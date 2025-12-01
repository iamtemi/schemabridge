// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Enable server-side rendering for API routes
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    starlight({
      plugins: [starlightThemeRapide()],
      title: 'SchemaBridge',
      description: 'Cross-language schema converter: Zod to Pydantic and TypeScript',
      customCss: ['./src/styles/global.css'],
      defaultLocale: 'en-us',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/iamtemi/schemabridge' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/schemabridge' },
        { icon: 'seti:python', label: 'Python', href: 'https://pypi.org/project/schemabridge/' },
        { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/temi-adenuga/' },
      ],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            {
              label: 'Introduction',
              slug: 'introduction',
            },
            {
              label: 'Getting Started',
              slug: 'getting-started',
            },
            {
              label: 'API Reference',
              slug: 'api',
            },
            {
              label: 'CLI',
              slug: 'cli',
            },
            {
              label: 'Folder Conversion',
              slug: 'folder-conversion',
            },
            {
              label: 'Use Cases',
              slug: 'use-cases',
            },
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./', import.meta.url).pathname,
      },
    },
    server: {
      watch: {
        // Ignore these paths to prevent infinite loops from temp file creation
        ignored: (path) => {
          return (
            path.includes('node_modules') ||
            path.includes('/.astro/') ||
            path.includes('/dist/') ||
            path.startsWith('/tmp/') ||
            path.startsWith('/var/') ||
            path.startsWith('/private/') ||
            path.includes('/schemabridge-')
          );
        },
      },
    },
  },
});
