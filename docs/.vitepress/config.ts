import { defineConfig } from 'vitepress';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';

export default defineConfig({
  title: 'SchemaBridge',
  description: 'Cross-language schema converter: Zod → Pydantic & TypeScript',
  base: '/schemabridge/',

  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
    },
  },

  vite: {
    plugins: [
      groupIconVitePlugin({
        customIcon: {
          npm: 'vscode-icons:file-type-npm',
          python: 'vscode-icons:file-type-python',
          pnpm: 'vscode-icons:file-type-light-pnpm',
          yarn: 'vscode-icons:file-type-yarn',
          bun: 'logos:bun',
          ts: 'vscode-icons:file-type-typescript',
          js: 'vscode-icons:file-type-js',
        },
      }),
    ],
  },

  themeConfig: {
    search: {
      provider: 'local',
    },

    outline: [2, 3],

    nav: [
      { text: 'Guide', link: '/' },
      { text: 'GitHub', link: 'https://github.com/iamtemi/schemabridge' },
    ],

    sidebar: [
      { text: 'Introduction', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Use Cases', link: '/use-cases' },
      {
        text: 'Reference',
        items: [
          { text: 'CLI Guide', link: '/cli' },
          { text: 'Folder Conversion', link: '/folder-conversion' },
          { text: 'API Reference', link: '/api' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/iamtemi/schemabridge' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present',
    },
  },
});
