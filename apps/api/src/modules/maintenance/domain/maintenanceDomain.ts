import { MaintenanceRequestDto, MaintenanceNoteDto } from '@smart-campus/shared-types';
import {
  StoredMaintenanceRequest,
  StoredMaintenanceNote,
  maintenanceNotes,
  rooms,
  buildings,
  users,
  MaintenanceStatus,
} from '../../../database/mockStore';

export function maintenanceNoteToDto(note: StoredMaintenanceNote): MaintenanceNoteDto {
  const author = users.find((u) => u.id === note.authorId);
  return {
    id: note.id,
    requestId: note.requestId,
    authorId: note.authorId,
    authorName: author?.name || 'Tecnico N/A',
    content: note.content,
    createdAt: note.createdAt.toISOString(),
  };
}

export function maintenanceRequestToDto(request: StoredMaintenanceRequest): MaintenanceRequestDto {
  const room = rooms.find((r) => r.id === request.roomId);
  const building = room ? buildings.find((b) => b.id === room.buildingId) : undefined;
  const reporter = users.find((u) => u.id === request.reportedById);
  const assignee = request.assignedToId ? users.find((u) => u.id === request.assignedToId) : undefined;

  const notes = maintenanceNotes
    .filter((n) => n.requestId === request.id)
    .map(maintenanceNoteToDto);

  return {
    id: request.id,
    code: request.code,
    title: request.title,
    description: request.description,
    category: request.category,
    priority: request.priority,
    status: request.status,
    roomId: request.roomId,
    roomCode: room?.code || 'SALA N/A',
    buildingName: building?.name || 'Edificio N/A',
    reportedById: request.reportedById,
    reportedByName: reporter?.name || 'Utilizador N/A',
    assignedToId: request.assignedToId,
    assignedToName: assignee?.name,
    estimatedCost: request.estimatedCost,
    resolvedAt: request.resolvedAt?.toISOString(),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    notes,
  };
}

/**
 * Valida a transicao de estado de um pedido de manutencao.
 */
export function validateStatusTransition(current: MaintenanceStatus, nextStatus: MaintenanceStatus): void {
  if (current === nextStatus) return;

  if (current === 'CLOSED' || current === 'CANCELLED') {
    throw Object.assign(
      new Error(`Nao e possivel alterar o estado de um pedido que ja esta ${current}.`),
      { statusCode: 400, code: 'INVALID_STATUS_TRANSITION' }
    );
  }

  if (nextStatus === 'RESOLVED' && current === 'OPEN') {
    throw Object.assign(
      new Error('Um pedido deve passar para IN_PROGRESS antes de ser marcado como RESOLVED.'),
      { statusCode: 400, code: 'INVALID_STATUS_TRANSITION' }
    );
  }
}
