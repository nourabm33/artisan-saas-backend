import { Request, Response } from 'express';
import {
  LoginCommand,
  RefreshTokenCommand,
  RegisterCommand,
} from '../../../application/dtos/AuthDtos';
import { RegisterUseCase } from '../../../application/use-cases/auth/RegisterUseCase';
import { LoginUseCase } from '../../../application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/RefreshTokenUseCase';
import { GetCurrentUserUseCase } from '../../../application/use-cases/auth/GetCurrentUserUseCase';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.registerUseCase.execute(req.body as RegisterCommand);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.loginUseCase.execute(req.body as LoginCommand);
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.refreshTokenUseCase.execute(req.body as RefreshTokenCommand);
    res.status(200).json(result);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const user = await this.getCurrentUserUseCase.execute(auth.userId);
    res.status(200).json({ user });
  };
}
