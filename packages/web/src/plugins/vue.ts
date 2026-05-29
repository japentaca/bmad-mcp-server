import type { App } from 'vue';
import PrimeVue from 'primevue/config';

export default {
  install(app: App) {
    app.use(PrimeVue, { ripple: true });
  },
};
