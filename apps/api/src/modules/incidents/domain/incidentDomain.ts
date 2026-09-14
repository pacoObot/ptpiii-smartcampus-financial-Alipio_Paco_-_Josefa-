import { IncidentDto } from '@smart-campus/shared-types';
import { StoredIncident, rooms, users } from '../../../database/mockStore';

export function incidentToDto(incident: StoredIncident): IncidentDto {
  const room = rooms.find((r) => r.id === incident.roomId);
  const reporter = users.find((u) => u.id === incident.reportedById);
  const assignee = incident.assignedToId ? users.find((u) => u.id === incident.assignedToId) : undefined;

  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    roomId: incident.roomId,
    roomCode: room?.code || 'SALA N/A',
    reportedById: incident.reportedById,
    reportedByName: reporter?.name || 'Utilizador N/A',
    assignedToId: incident.assignedToId,
    assignedToName: assignee?.name,
    status: incident.status,
    priority: incident.priority,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}
