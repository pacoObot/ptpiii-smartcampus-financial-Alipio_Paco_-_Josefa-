import crypto from 'crypto';
import { incidents, rooms, users } from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import { incidentToDto } from '../domain/incidentDomain';
import { IncidentDto } from '@smart-campus/shared-types';
import { CreateIncidentInput, UpdateIncidentStatusInput } from '@smart-campus/validation';

interface CreateIncidentCommand {
  input: CreateIncidentInput;
  actorId: string;
  correlationId: string;
}

interface UpdateStatusCommand {
  id: string;
  input: UpdateIncidentStatusInput;
  actorId: string;
  correlationId: string;
}

export async function listAll(): Promise<IncidentDto[]> {
  return incidents.map(incidentToDto);
}

export async function findById(id: string): Promise<IncidentDto> {
  const incident = incidents.find((i) => i.id === id);
  if (!incident) {
    throw Object.assign(new Error('Ocorrencia nao encontrada.'), { statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
  }
  return incidentToDto(incident);
}

export async function create(command: CreateIncidentCommand): Promise<IncidentDto> {
  const roomExists = rooms.find((r) => r.id === command.input.roomId || r.code.toLowerCase() === command.input.roomId.toLowerCase());
  if (!roomExists) {
    throw Object.assign(new Error('A sala indicada nao existe.'), { statusCode: 404, code: 'ROOM_NOT_FOUND' });
  }

  const now = new Date();
  const newIncident = {
    id: `inc_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    title: command.input.title,
    description: command.input.description,
    roomId: roomExists.id,
    reportedById: command.actorId,
    status: 'OPEN' as const,
    priority: command.input.priority,
    createdAt: now,
    updatedAt: now,
  };

  incidents.push(newIncident);

  await auditLog({
    action: 'INCIDENT_CREATED',
    module: 'incidents',
    resourceId: newIncident.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { title: newIncident.title, priority: newIncident.priority, roomId: newIncident.roomId },
  });

  return incidentToDto(newIncident);
}

export async function updateStatus(command: UpdateStatusCommand): Promise<IncidentDto> {
  const incident = incidents.find((i) => i.id === command.id);
  if (!incident) {
    throw Object.assign(new Error('Ocorrencia nao encontrada.'), { statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
  }

  if (command.input.assignedToId) {
    const assigneeExists = users.find((u) => u.id === command.input.assignedToId);
    if (!assigneeExists) {
      throw Object.assign(new Error('O tecnico atribuido nao existe.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    incident.assignedToId = command.input.assignedToId;
  }

  const oldStatus = incident.status;
  incident.status = command.input.status;
  incident.updatedAt = new Date();

  await auditLog({
    action: 'INCIDENT_STATUS_CHANGED',
    module: 'incidents',
    resourceId: incident.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { oldStatus, newStatus: incident.status, assignedToId: incident.assignedToId },
  });

  return incidentToDto(incident);
}
