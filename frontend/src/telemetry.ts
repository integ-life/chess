import { MetricsClient } from '@integ-life/metrics-web'

const endpoint = import.meta.env.VITE_METRICS_ENDPOINT?.trim()
const writeKey = import.meta.env.VITE_METRICS_WRITE_KEY?.trim()
export const telemetry = endpoint && writeKey
  ? new MetricsClient({ endpoint, writeKey, environment: import.meta.env.VITE_METRICS_ENVIRONMENT || 'production', release: import.meta.env.VITE_APP_VERSION || 'web', service: 'chess-frontend' }).start()
  : undefined

const page = () => telemetry?.page(window.location.hash.slice(1).split(/[?#]/, 1)[0] || '/')
page()
window.addEventListener('hashchange', page)
