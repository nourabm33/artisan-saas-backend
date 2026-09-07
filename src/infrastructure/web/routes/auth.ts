import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../../../application/services/AuthService';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '../../../application/dtos/AuthDtos';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';

export const createAuthRouter = (controller: AuthController, authService: AuthService): Router => {
  const router = Router();

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);
  router.post('/refresh', validateBody(refreshTokenSchema), controller.refresh);
  router.get('/me', authenticate(authService), controller.me);

  return router;
};
