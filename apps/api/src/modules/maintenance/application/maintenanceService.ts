import crypto from 'crypto';
import {
  maintenanceRequests,
  maintenanceNotes,
  rooms,
  users,
  StoredMaintenanceRequest,
  StoredMaintenanceNote,
} from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import {
  maintenanceRequestToDto,
  maintenanceNoteToDto,
  validateStatusTransition,
} from '../domain/maintenanceDomain';
import {
  MaintenanceRequestDto,
  MaintenanceNoteDto,
  MaintenanceStatsDto,
} from '@smart-campus/shared-types';
import {
  CreateMaintenanceRequestInput,
  UpdateMaintenanceStatusInput,
  AddMaintenanceNoteInput,
  FilterMaintenanceQueryInput,
} from '@smart-campus/validation';

interface CreateCommand {
  input: CreateMaintenanceRequestInput;
  actorId: string;
  correlationId: string;
}

interface UpdateStatusCommand {
  id: string;
  input: UpdateMaintenanceStatusInput;
  actorId: string;
  correlationId: string;
}

interface AddNoteCommand {
  requestId: string;
  input: AddMaintenanceNoteInput;
  actorId: string;
  correlationId: string;
}

export async function listRequests(filter?: FilterMaintenanceQueryInput): Promise<MaintenanceRequestDto[]> {
  let result = maintenanceRequests.slice();

  if (filter?.status) {
    result = result.filter((r) => r.status === filter.status);
  }
  if (filter?.priority) {
    result = result.filter((r) => r.priority === filter.priority);
  }
  if (filter?.category) {
    result = result.filter((r) => r.category === filter.category);
  }
  if (filter?.roomId) {
    result = result.filter((r) => r.roomId === filter.roomId);
  }
  if (filter?.assignedToId) {
    result = result.filter((r) => r.assignedToId === filter.assignedToId);
  }

  // Ordenar por prioridade (URGENT > HIGH > MEDIUM > LOW) e data recente
  const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  result.sort((a, b) => {
    const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return result.map(maintenanceRequestToDto);
}

export async function getRequestById(id: string): Promise<MaintenanceRequestDto> {
  const req = maintenanceRequests.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
  if (!req) {
    throw Object.assign(new Error('Pedido de manutencao nao encontrado.'), { statusCode: 404, code: 'MAINTENANCE_NOT_FOUND' });
  }
  return maintenanceRequestToDto(req);
}

export async function getStats(): Promise<MaintenanceStatsDto> {
  const total = maintenanceRequests.length;
  const open = maintenanceRequests.filter((r) => r.status === 'OPEN').length;
  const inProgress = maintenanceRequests.filter((r) => r.status === 'IN_PROGRESS').length;
  const resolved = maintenanceRequests.filter((r) => r.status === 'RESOLVED').length;
  const closed = maintenanceRequests.filter((r) => r.status === 'CLOSED').length;
  const cancelled = maintenanceRequests.filter((r) => r.status === 'CANCELLED').length;
  const urgent = maintenanceRequests.filter((r) => r.priority === 'URGENT').length;
  const high = maintenanceRequests.filter((r) => r.priority === 'HIGH').length;

  const byCategory: Record<string, number> = {};
  for (const r of maintenanceRequests) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }

  return {
    totalRequests: total,
    openRequests: open,
    inProgressRequests: inProgress,
    resolvedRequests: resolved,
    closedRequests: closed,
    cancelledRequests: cancelled,
    urgentRequests: urgent,
    highPriorityRequests: high,
    byCategory,
  };
}

export async function createRequest(command: CreateCommand): Promise<MaintenanceRequestDto> {
  const room = rooms.find((r) => r.id === command.input.roomId || r.code.toLowerCase() === command.input.roomId.toLowerCase());
  if (!room) {
    throw Object.assign(new Error('A sala indicada para manutencao nao existe no campus.'), {
      statusCode: 404,
      code: 'ROOM_NOT_FOUND',
    });
  }

  const now = new Date();
  const countNext = maintenanceRequests.length + 1;
  const code = `MN-2026-${String(countNext).padStart(3, '0')}`;

  const newReq: StoredMaintenanceRequest = {
    id: `mnt_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    code,
    title: command.input.title,
    description: command.input.description,
    category: command.input.category,
    priority: command.input.priority,
    status: 'OPEN',
    roomId: room.id,
    reportedById: command.actorId,
    estimatedCost: command.input.estimatedCost,
    createdAt: now,
    updatedAt: now,
  };

  maintenanceRequests.push(newReq);

  await auditLog({
    action: 'MAINTENANCE_REQUEST_CREATED',
    module: 'maintenance',
    resourceId: newReq.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { code: newReq.code, title: newReq.title, category: newReq.category, priority: newReq.priority },
  });

  return maintenanceRequestToDto(newReq);
}

export async function updateStatus(command: UpdateStatusCommand): Promise<MaintenanceRequestDto> {
  const req = maintenanceRequests.find((r) => r.id === command.id || r.code.toLowerCase() === command.id.toLowerCase());
  if (!req) {
    throw Object.assign(new Error('Pedido de manutencao nao encontrado.'), { statusCode: 404, code: 'MAINTENANCE_NOT_FOUND' });
  }

  validateStatusTransition(req.status, command.input.status);

  const oldStatus = req.status;
  req.status = command.input.status;
  req.updatedAt = new Date();

  if (command.input.assignedToId) {
    const tech = users.find((u) => u.id === command.input.assignedToId);
    if (!tech) {
      throw Object.assign(new Error('O tecnico indicado para atribuicao nao existe.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    req.assignedToId = tech.id;
  }

  if (command.input.estimatedCost !== undefined) {
    req.estimatedCost = command.input.estimatedCost;
  }

  if (command.input.status === 'RESOLVED') {
    req.resolvedAt = new Date();
  }

  // Registar nota explicativa se fornecida
  if (command.input.note) {
    const noteObj: StoredMaintenanceNote = {
      id: `note_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
      requestId: req.id,
      authorId: command.actorId,
      content: command.input.note,
      createdAt: new Date(),
    };
    maintenanceNotes.push(noteObj);
  }

  await auditLog({
    action: 'MAINTENANCE_STATUS_CHANGED',
    module: 'maintenance',
    resourceId: req.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { oldStatus, newStatus: req.status, assignedToId: req.assignedToId },
  });

  return maintenanceRequestToDto(req);
}

export async function addNote(command: AddNoteCommand): Promise<MaintenanceNoteDto> {
  const req = maintenanceRequests.find((r) => r.id === command.requestId || r.code.toLowerCase() === command.requestId.toLowerCase());
  if (!req) {
    throw Object.assign(new Error('Pedido de manutencao nao encontrado.'), { statusCode: 404, code: 'MAINTENANCE_NOT_FOUND' });
  }

  const newNote: StoredMaintenanceNote = {
    id: `note_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    requestId: req.id,
    authorId: command.actorId,
    content: command.input.content,
    createdAt: new Date(),
  };

  maintenanceNotes.push(newNote);
  req.updatedAt = new Date();

  await auditLog({
    action: 'MAINTENANCE_NOTE_ADDED',
    module: 'maintenance',
    resourceId: req.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { noteId: newNote.id, snippet: newNote.content.substring(0, 50) },
  });

  return maintenanceNoteToDto(newNote);
}
