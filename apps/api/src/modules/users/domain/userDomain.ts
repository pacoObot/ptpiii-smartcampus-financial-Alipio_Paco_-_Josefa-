import { UserDto } from '@smart-campus/shared-types';
import { StoredUser } from '../../../database/mockStore';

export function userToDto(user: StoredUser): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    department: user.department,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
