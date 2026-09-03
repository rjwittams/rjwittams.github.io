import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://robert.wittams.com',
  redirects: {
    // the 2020 Jekyll URL for the Druid notes
    '/druid_state': '/posts/druid-widget-state/',
  },
});
