import { Request, Response, Router } from 'express';

export type HealthProbe = () => Promise<boolean>;

export interface HealthDependencies {
  database: HealthProbe;
  redis: HealthProbe;
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

  router.get('/', async (_req: Request, res: Response) => {
    const [database, redis] = await Promise.all([probe(deps.database), probe(deps.redis)]);
    const healthy = database === 'connected' && redis === 'connected';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      database,
      redis,
    });
  });

  return router;
};
