interface Env {
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin'
};

const IMMUTABLE_ASSET_PATTERN = /^\/assets\//;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(url);

    const headers = new Headers(assetResponse.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);

    if (IMMUTABLE_ASSET_PATTERN.test(url.pathname)) {
      headers.set('cache-control', 'public, max-age=31536000, immutable');
    } else if (assetResponse.status < 400) {
      headers.set('cache-control', 'no-cache');
    }

    return new Response(assetResponse.body, { status: assetResponse.status, headers });
  }
} satisfies ExportedHandler<Env>;
