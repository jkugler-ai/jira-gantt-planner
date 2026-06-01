import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/jira-gantt-planner/',
  server: {
    port: 4200,
    proxy: {
      '/api': {
        target: 'http://localhost:4201',
        changeOrigin: true,
      },
    },
  },
});
