import { auditEvents, StoredAuditEvent } from '../database/mockStore';
import crypto from 'crypto';

interface AuditCommand {
  action: string;
  module: string;
  resourceId: string;
  actorId: string;
  correlationId: string;
  payload?: Record<string, unknown>;
}

/**
 * Regista um evento de auditoria para toda mutacao relevante.
 * Deve ser chamado em todos os POST, PATCH e DELETE que alterem dados.
 */
export async function auditLog(command: AuditCommand): Promise<void> {
  const event: StoredAuditEvent = {
    id: `aud_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
    correlationId: command.correlationId,
    userId: command.actorId,
    action: command.action,
    module: command.module,
    resourceId: command.resourceId,
    payload: command.payload || {},
    createdAt: new Date(),
  };
  auditEvents.push(event);
}
