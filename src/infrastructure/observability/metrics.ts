import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import client from 'prom-client';

export interface Metrics {
  registry: client.Registry;
  httpMiddleware: RequestHandler;
  router: Router;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Collapses ids so label cardinality stays bounded: /quotes/<uuid>/send → /quotes/:id/send */
export const normalizeRoute = (req: Request): string => {
  const matched = req.route?.path;
  if (typeof matched === 'string' && req.baseUrl)
    return `${req.baseUrl}${matched}`.replace(/\/$/, '') || '/';
  const path = (req.originalUrl.split('?')[0] ?? '/').replace(UUID_RE, ':id');
  return path.replace(/\/$/, '') || '/';
};

export const createMetrics = (opts: { token?: string; prefix?: string } = {}): Metrics => {
  const registry = new client.Registry();
  const prefix = opts.prefix ?? 'artisan_';
  client.collectDefaultMetrics({ register: registry, prefix });

  const requests = new client.Counter({
    name: `${prefix}http_requests_total`,
    help: 'HTTP requests served',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });
  const duration = new client.Histogram({
    name: `${prefix}http_request_duration_seconds`,
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });
  const inFlight = new client.Gauge({
    name: `${prefix}http_requests_in_flight`,
    help: 'HTTP requests currently being handled',
    registers: [registry],
  });

  const httpMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') {
      next();
      return;
    }
    inFlight.inc();
    const end = duration.startTimer();
    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: normalizeRoute(req),
        status: String(res.statusCode),
      };
      requests.inc(labels);
      end(labels);
      inFlight.dec();
    });
    next();
  };

  const router = Router();
  router.get('/', async (req: Request, res: Response) => {
    if (opts.token) {
      const header = req.header('authorization') ?? '';
      if (header !== `Bearer ${opts.token}`) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid metrics token' } });
        return;
      }
    }
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  return { registry, httpMiddleware, router };
};
