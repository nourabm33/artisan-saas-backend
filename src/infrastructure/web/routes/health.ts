import { Request, Response, Router } from 'express';

export type HealthProbe = () => Promise<boolean>;

export interface HealthDependencies {
  database: HealthProbe;
  redis: HealthProbe;
  /** Reported as `version` (e.g. git SHA / image tag). */
  release?: string;
}

const probe = async (check: HealthProbe): Promise<'connected' | 'disconnected'> => {
  try {
    return (await check()) ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
};

export const createHealthRouter = (deps: HealthDependencies): Router => {
  const router = Router();

  const readiness = async (_req: Request, res: Response): Promise<void> => {
    const [database, redis] = await Promise.all([probe(deps.database), probe(deps.redis)]);
    const healthy = database === 'connected' && redis === 'connected';

    res.setHeader('Cache-Control', 'no-store');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: deps.release ?? 'dev',
      database,
      redis,
    });
  };

  /** Full dependency check (backwards compatible) — use for readiness probes / load balancers. */
  router.get('/', readiness);
  router.get('/ready', readiness);

  /** Process-only liveness: never touches the DB, so a DB outage doesn't trigger restarts. */
  router.get('/live', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  return router;
};
