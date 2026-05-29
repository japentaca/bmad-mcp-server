import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vue from '@astrojs/vue';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    vue({
      appEntrypoint: '/src/plugins/vue',
    }),
  ],
  vite: {
    resolve: {
      alias: {
        '@lib': '/src/lib',
        '@components': '/src/components',
        '@layouts': '/src/layouts',
      },
    },
    ssr: {
      noExternal: ['primevue', '@vue-flow/core', 'vue-echarts'],
    },
    build: {
      rollupOptions: {
        external: ['@opencode-ai/sdk'],
      },
    },
    plugins: [
      {
        name: 'externalize-opencode-sdk',
        resolveId(id) {
          if (id === '@opencode-ai/sdk') {
            return { id, external: true };
          }
        },
      },
    ],
  },
});
