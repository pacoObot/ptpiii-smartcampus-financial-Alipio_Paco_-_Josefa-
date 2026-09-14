import { users, rooms, incidents } from '../../../database/mockStore';
import { incidentToDto } from '../../incidents/domain/incidentDomain';
import { DashboardDto } from '@smart-campus/shared-types';

export async function getSummary(): Promise<DashboardDto> {
  const totalUsers = users.length;
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r) => r.isAvailable).length;
  const openIncidents = incidents.filter((i) => i.status === 'OPEN').length;
  const inProgressIncidents = incidents.filter((i) => i.status === 'IN_PROGRESS').length;

  const recentIncidents = incidents
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map(incidentToDto);

  return {
    summary: {
      totalUsers,
      totalRooms,
      availableRooms,
      openIncidents,
      inProgressIncidents,
    },
    recentIncidents,
    auditedAt: new Date().toISOString(),
  };
}
