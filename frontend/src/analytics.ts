const measurementId = 'G-KD083M4PHC';
const productionHost = 'chess.integ.life';
const publicPaths = new Set(['/', '/engine-lab', '/course', '/course/foundation', '/course/mates', '/course/tactics', '/course/opening', '/course/middlegame', '/course/middlegame-plans', '/course/endgames', '/course/practice', '/play', '/explore', '/qipu-resources', '/changelog']);

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  integAnalyticsStarted?: boolean;
};

export function analyticsPath(hash: string) {
  const path = (hash.replace(/^#/, '').split(/[?#]/, 1)[0] || '/').replace(/\/$/, '') || '/';
  if (/^\/(games|explore)\/[^/]+$/.test(path)) return `/${path.split('/')[1]}/:id`;
  return publicPaths.has(path) ? path : '/not-found';
}

export function startAnalytics(win: AnalyticsWindow = window) {
  if (win.location.hostname !== productionHost || win.top !== win.self || win.integAnalyticsStarted) return;
  win.integAnalyticsStarted = true;
  win.dataLayer = win.dataLayer || [];
  // The Google tag consumes the standard gtag Arguments command format.
  function gtag(..._args: unknown[]) { win.dataLayer!.push(arguments); }
  gtag('js', new Date());
  gtag('set', { allow_google_signals: false, allow_ad_personalization_signals: false });
  gtag('config', measurementId, {
    send_page_view: false,
    page_location: `https://${productionHost}${analyticsPath(win.location.hash)}`,
    page_referrer: '',
    page_title: 'Integ Chess',
  });
  let previous = '';
  const track = () => {
    const path = analyticsPath(win.location.hash);
    const routeKey = win.location.hash.split(/[?#]/).slice(1, 2)[0] || '/';
    if (routeKey === previous) return;
    previous = routeKey;
    gtag('set', { page_location: `https://${productionHost}${path}`, page_referrer: '', page_title: 'Integ Chess' });
    gtag('event', 'page_view', { send_to: measurementId, page_location: `https://${productionHost}${path}`, page_referrer: '', page_title: 'Integ Chess' });
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = win.history[method];
    win.history[method] = function (...args: Parameters<History[typeof method]>) {
      original.apply(this, args);
      track();
    };
  }
  win.addEventListener('popstate', track);
  win.addEventListener('hashchange', track);
  track();
  const script = win.document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  win.document.head.append(script);
}
