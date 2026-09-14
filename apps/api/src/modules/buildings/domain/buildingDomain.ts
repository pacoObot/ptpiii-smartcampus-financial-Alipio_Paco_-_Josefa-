import { BuildingDto } from '@smart-campus/shared-types';
import { StoredBuilding } from '../../../database/mockStore';

export function buildingToDto(building: StoredBuilding): BuildingDto {
  return {
    id: building.id,
    code: building.code,
    name: building.name,
    address: building.address,
    floors: building.floors,
    createdAt: building.createdAt.toISOString(),
  };
}
