import { User } from '../../domain/entities/User';
import { UserDto } from '../dtos/AuthDtos';

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  orgId: user.orgId,
  email: user.email.get(),
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
});
