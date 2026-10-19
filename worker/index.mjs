import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, service: 'pdf-classtools-vn', runtime: 'cloudflare-workers' });
});

// Reserve API URLs so a missing endpoint never becomes SPA HTML.
app.all('/api', (c) => c.json({ error: 'not_found' }, 404));
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

// Cloudflare serves matching static assets before invoking this fallback.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
