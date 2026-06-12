import { hasConsent } from './consent';

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

interface MixpanelApi {
  init(token: string, options: Record<string, unknown>): void;
  identify(userId: string): void;
  reset(): void;
  track(event: string, properties?: AnalyticsProperties): void;
  opt_in_tracking(): void;
  opt_out_tracking(): void;
}

let client: MixpanelApi | null = null;
let loading: Promise<MixpanelApi | null> | null = null;

function configuredToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim();
  if (!token || /^(your-|placeholder|changeme)/i.test(token)) return null;
  return token;
}

async function loadClient(): Promise<MixpanelApi | null> {
  if (client) return client;
  if (!hasConsent('analytics')) return null;
  const token = configuredToken();
  if (!token) return null;
  if (!loading) {
    loading = import('mixpanel-browser').then(({ default: mixpanel }) => {
      client = mixpanel as unknown as MixpanelApi;
      client.init(token, {
        debug: process.env.NODE_ENV === 'development',
        persistence: 'localStorage',
        opt_out_tracking_by_default: true,
        ignore_dnt: false,
      });
      client.opt_in_tracking();
      return client;
    });
  }
  return loading;
}

export async function syncAnalyticsConsent(): Promise<void> {
  if (!hasConsent('analytics')) {
    client?.opt_out_tracking();
    client?.reset();
    return;
  }
  const loaded = await loadClient();
  loaded?.opt_in_tracking();
}

export async function identifyAnalyticsUser(userId: string | null): Promise<void> {
  if (!userId) {
    client?.reset();
    return;
  }
  const loaded = await loadClient();
  loaded?.identify(userId);
}

export async function trackProductEvent(
  event: string,
  properties: AnalyticsProperties = {}
): Promise<void> {
  if (!hasConsent('analytics')) return;
  const loaded = await loadClient();
  loaded?.track(event, properties);
}

export function analyticsConfigured(): boolean {
  return configuredToken() !== null;
}
