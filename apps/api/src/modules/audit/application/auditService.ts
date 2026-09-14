import { auditEvents, users } from '../../../database/mockStore';
import { AuditEventDto } from '@smart-campus/shared-types';

export async function listAll(): Promise<AuditEventDto[]> {
  return auditEvents.map((event) => {
    const user = users.find((u) => u.id === event.userId);
    return {
      id: event.id,
      correlationId: event.correlationId,
      userId: event.userId,
      userName: user?.name || 'Utilizador Desconhecido',
      action: event.action,
      module: event.module,
      resourceId: event.resourceId,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    };
  });
}
