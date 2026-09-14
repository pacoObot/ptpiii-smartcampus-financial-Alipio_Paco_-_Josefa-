import { UserDto } from '@smart-campus/shared-types';
import { StoredUser } from '../../../database/mockStore';

/**
 * Converte um utilizador armazenado para DTO de resposta.
 * NUNCA incluir passwordHash no DTO.
 */
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

/**
 * Verifica se as credenciais sao validas para o utilizador.
 * Em producao, usar bcrypt.compare(password, user.passwordHash).
 * Em modo demo, comparacao directa (passwordHash e a password em texto).
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  return plainPassword === storedHash;
}
