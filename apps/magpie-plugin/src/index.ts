import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { type IncomingMessage, createServer } from 'node:http';
import { createActions } from './actions';

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function start(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid NowCoding service port');
  const host = `127.0.0.1:${port}`;
  const origin = `http://${host}`;
  const token = randomBytes(32).toString('hex');
  const dispatch = createActions();
  const assets = new Map([
    ['/app.js', 'text/javascript'],
    ['/style.css', 'text/css'],
  ]);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const fail = (status: number, message: string) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    };
    try {
      if (req.headers.host !== host && req.headers.host !== `localhost:${port}`)
        return fail(403, 'Invalid host');
      const route = new URL(req.url ?? '/', origin).pathname;
      if (req.method === 'GET' && route === '/health') {
        res.end('magpie-nowcoding/0.1.0');
        return;
      }
      if (route.startsWith('/api/')) {
        if (req.headers.origin && !['null', origin].includes(req.headers.origin))
          return fail(403, 'Invalid origin');
        if (req.headers.origin === 'null') {
          res.setHeader('Access-Control-Allow-Origin', 'null');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'content-type, x-nowcoding-page');
        }
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (req.method !== 'POST' || req.headers['x-nowcoding-page'] !== token)
          return fail(403, 'Page authorization required');
        const value = await dispatch(route.slice(5), await readBody(req));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(value));
        return;
      }
      if (req.method !== 'GET') return fail(405, 'Method not allowed');
      if (route === '/') {
        const template = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
        res.setHeader(
          'Content-Security-Policy',
          `default-src 'none'; script-src 'self' ${origin}; style-src 'self' ${origin}; connect-src 'self' ${origin}; base-uri 'none'; form-action 'none'; frame-ancestors 'self' wails: wails-localhost: http://localhost:* http://127.0.0.1:* https://localhost:*`,
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(template.replace('__PAGE_TOKEN__', token));
        return;
      }
      const type = assets.get(route);
      if (!type) return fail(404, 'Not found');
      res.setHeader('Content-Type', `${type}; charset=utf-8`);
      res.end(await readFile(new URL(`../ui${route}`, import.meta.url)));
    } catch (error) {
      fail(400, error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}
let listening: Promise<unknown> | undefined;
export default {
  id: 'magpie-nowcoding',
  async server(_input: unknown, options: { port?: number } = {}) {
    const port = options.port ?? 37481;
    listening ??= start(port).catch(async (error) => {
      if (error.code === 'EADDRINUSE') {
        const response = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(1500),
        });
        if ((await response.text()) === 'magpie-nowcoding/0.1.0') return;
      }
      listening = undefined;
      throw error;
    });
    await listening;
    return {};
  },
};
