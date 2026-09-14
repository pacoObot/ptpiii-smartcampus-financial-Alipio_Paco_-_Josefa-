import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../../config/env';
import { users, refreshTokens, StoredRefreshToken } from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import { userToDto, verifyPassword } from '../domain/authDomain';
import { AuthResponseDto, UserDto } from '@smart-campus/shared-types';

interface LoginCommand {
  email: string;
  password: string;
  correlationId: string;
}

interface RefreshCommand {
  refreshToken: string;
  correlationId: string;
}

interface LogoutCommand {
  actorId: string;
  refreshToken: string;
  correlationId: string;
}

interface GetMeCommand {
  actorId: string;
}

function generateTokenPair(userId: string, email: string, role: string): { accessToken: string; refreshToken: string } {
  const accessOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const accessToken = jwt.sign(
    { id: userId, email, role },
    env.JWT_SECRET,
    accessOptions
  );

  const refreshOptions: SignOptions = { expiresIn: '7d' };
  const refreshToken = jwt.sign(
    { id: userId },
    env.JWT_SECRET,
    refreshOptions
  );

  // Guardar refresh token no store
  const stored: StoredRefreshToken = {
    id: crypto.randomUUID(),
    userId,
    tokenHash: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
  };
  refreshTokens.push(stored);

  return { accessToken, refreshToken };
}

/**
 * Caso de uso: Login do utilizador.
 * Devolve user + tokens no formato exigido pelo manual (data.tokens.accessToken).
 */
export async function login(command: LoginCommand): Promise<AuthResponseDto> {
  const user = users.find((u) => u.email.toLowerCase() === command.email.toLowerCase());

  if (!user || !verifyPassword(command.password, user.passwordHash)) {
    throw Object.assign(new Error('Credenciais invalidas.'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Conta desactivada. Contacte o administrador.'), { statusCode: 401, code: 'ACCOUNT_INACTIVE' });
  }

  const tokens = generateTokenPair(user.id, user.email, user.role);

  await auditLog({
    action: 'USER_LOGIN',
    module: 'auth',
    resourceId: user.id,
    actorId: user.id,
    correlationId: command.correlationId,
    payload: { email: user.email, role: user.role },
  });

  return {
    user: userToDto(user),
    tokens,
  };
}

/**
 * Caso de uso: Renovar sessao com refresh token.
 */
export async function refresh(command: RefreshCommand): Promise<{ accessToken: string; refreshToken: string }> {
  let decoded: { id: string };
  try {
    decoded = jwt.verify(command.refreshToken, env.JWT_SECRET) as { id: string };
  } catch {
    throw Object.assign(new Error('Refresh token invalido ou expirado.'), { statusCode: 401, code: 'INVALID_TOKEN' });
  }

  const stored = refreshTokens.find((rt) => rt.tokenHash === command.refreshToken && !rt.revoked);
  if (!stored) {
    throw Object.assign(new Error('Refresh token revogado ou inexistente.'), { statusCode: 401, code: 'TOKEN_REVOKED' });
  }

  const user = users.find((u) => u.id === decoded.id && u.isActive);
  if (!user) {
    throw Object.assign(new Error('Utilizador nao encontrado ou inactivo.'), { statusCode: 401, code: 'USER_NOT_FOUND' });
  }

  // Revogar token antigo
  stored.revoked = true;

  return generateTokenPair(user.id, user.email, user.role);
}

/**
 * Caso de uso: Revogar refresh token (logout).
 */
export async function logout(command: LogoutCommand): Promise<void> {
  const stored = refreshTokens.find((rt) => rt.tokenHash === command.refreshToken && rt.userId === command.actorId);
  if (stored) {
    stored.revoked = true;
  }

  await auditLog({
    action: 'USER_LOGOUT',
    module: 'auth',
    resourceId: command.actorId,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: {},
  });
}

/**
 * Caso de uso: Obter perfil do utilizador autenticado.
 */
export async function getMe(command: GetMeCommand): Promise<UserDto> {
  const user = users.find((u) => u.id === command.actorId);
  if (!user) {
    throw Object.assign(new Error('Utilizador nao encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
  }
  return userToDto(user);
}
