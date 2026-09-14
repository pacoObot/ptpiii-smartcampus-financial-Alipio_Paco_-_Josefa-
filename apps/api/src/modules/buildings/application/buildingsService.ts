import crypto from 'crypto';
import { buildings } from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import { buildingToDto } from '../domain/buildingDomain';
import { BuildingDto } from '@smart-campus/shared-types';
import { CreateBuildingInput } from '@smart-campus/validation';

interface CreateBuildingCommand {
  input: CreateBuildingInput;
  actorId: string;
  correlationId: string;
}

export async function listAll(): Promise<BuildingDto[]> {
  return buildings.map(buildingToDto);
}

export async function findById(id: string): Promise<BuildingDto> {
  const building = buildings.find((b) => b.id === id || b.code.toLowerCase() === id.toLowerCase());
  if (!building) {
    throw Object.assign(new Error('Edificio nao encontrado.'), { statusCode: 404, code: 'BUILDING_NOT_FOUND' });
  }
  return buildingToDto(building);
}

export async function create(command: CreateBuildingCommand): Promise<BuildingDto> {
  const exists = buildings.find((b) => b.code.toLowerCase() === command.input.code.toLowerCase());
  if (exists) {
    throw Object.assign(new Error(`Ja existe um edificio com o codigo ${command.input.code}.`), {
      statusCode: 409,
      code: 'BUILDING_CODE_CONFLICT',
    });
  }

  const newBuilding = {
    id: `bld_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    code: command.input.code,
    name: command.input.name,
    address: command.input.address,
    floors: command.input.floors,
    createdAt: new Date(),
  };

  buildings.push(newBuilding);

  await auditLog({
    action: 'BUILDING_CREATED',
    module: 'buildings',
    resourceId: newBuilding.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { code: newBuilding.code, name: newBuilding.name },
  });

  return buildingToDto(newBuilding);
}
