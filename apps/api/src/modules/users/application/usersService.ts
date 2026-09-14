import crypto from 'crypto';
import { users } from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import { userToDto } from '../domain/userDomain';
import { UserDto } from '@smart-campus/shared-types';
import { CreateUserInput } from '@smart-campus/validation';

interface CreateUserCommand {
  input: CreateUserInput;
  actorId: string;
  correlationId: string;
}

/**
 * Caso de uso: Listar todos os utilizadores (sem passwords).
 * Roles permitidas: ADMIN, COORDINATOR.
 */
export async function listAll(): Promise<UserDto[]> {
  return users.map(userToDto);
}

/**
 * Caso de uso: Obter utilizador por ID.
 */
export async function findById(id: string): Promise<UserDto> {
  const user = users.find((u) => u.id === id);
  if (!user) {
    throw Object.assign(new Error('Utilizador nao encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
  }
  return userToDto(user);
}

/**
 * Caso de uso: Criar novo utilizador.
 * Role permitida: ADMIN.
 * Invariante: email deve ser unico.
 */
export async function create(command: CreateUserCommand): Promise<UserDto> {
  const exists = users.find((u) => u.email.toLowerCase() === command.input.email.toLowerCase());
  if (exists) {
    throw Object.assign(new Error(`Ja existe um utilizador com o e-mail ${command.input.email}.`), {
      statusCode: 409,
      code: 'EMAIL_CONFLICT',
    });
  }

  const now = new Date();
  const newUser = {
    id: `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    name: command.input.name,
    email: command.input.email,
    passwordHash: command.input.password,
    role: command.input.role,
    studentId: command.input.studentId,
    department: command.input.department,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);

  await auditLog({
    action: 'USER_CREATED',
    module: 'users',
    resourceId: newUser.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { email: newUser.email, role: newUser.role },
  });

  return userToDto(newUser);
}
