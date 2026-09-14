import crypto from 'crypto';
import { rooms, buildings } from '../../../database/mockStore';
import { auditLog } from '../../../utils/audit';
import { roomToDto } from '../domain/roomDomain';
import { RoomDto } from '@smart-campus/shared-types';
import { CreateRoomInput } from '@smart-campus/validation';

interface CreateRoomCommand {
  input: CreateRoomInput;
  actorId: string;
  correlationId: string;
}

export async function listAll(): Promise<RoomDto[]> {
  return rooms.map(roomToDto);
}

export async function findById(id: string): Promise<RoomDto> {
  const room = rooms.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
  if (!room) {
    throw Object.assign(new Error('Sala nao encontrada.'), { statusCode: 404, code: 'ROOM_NOT_FOUND' });
  }
  return roomToDto(room);
}

export async function create(command: CreateRoomCommand): Promise<RoomDto> {
  const buildingExists = buildings.find((b) => b.id === command.input.buildingId);
  if (!buildingExists) {
    throw Object.assign(new Error('O edificio indicado nao existe.'), { statusCode: 404, code: 'BUILDING_NOT_FOUND' });
  }

  const exists = rooms.find((r) => r.code.toLowerCase() === command.input.code.toLowerCase());
  if (exists) {
    throw Object.assign(new Error(`Ja existe uma sala com o codigo ${command.input.code}.`), {
      statusCode: 409,
      code: 'ROOM_CODE_CONFLICT',
    });
  }

  const now = new Date();
  const newRoom = {
    id: `room_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
    code: command.input.code,
    name: command.input.name,
    buildingId: command.input.buildingId,
    floor: command.input.floor,
    capacity: command.input.capacity,
    isAvailable: true,
    type: command.input.type,
    createdAt: now,
    updatedAt: now,
  };

  rooms.push(newRoom);

  await auditLog({
    action: 'ROOM_CREATED',
    module: 'rooms',
    resourceId: newRoom.id,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: { code: newRoom.code, buildingId: newRoom.buildingId },
  });

  return roomToDto(newRoom);
}
