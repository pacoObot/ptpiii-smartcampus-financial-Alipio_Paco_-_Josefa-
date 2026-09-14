import { RoomDto } from '@smart-campus/shared-types';
import { StoredRoom, buildings } from '../../../database/mockStore';

export function roomToDto(room: StoredRoom): RoomDto {
  const building = buildings.find((b) => b.id === room.buildingId);
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    buildingId: room.buildingId,
    buildingName: building?.name || 'Edificio N/A',
    floor: room.floor,
    capacity: room.capacity,
    isAvailable: room.isAvailable,
    type: room.type,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}
