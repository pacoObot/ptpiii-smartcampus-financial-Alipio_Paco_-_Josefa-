/**
 * Base de dados em memoria para demonstracao do Smart Campus Core e Modulo de Manutencao (Grupo 5).
 * Substitua as operacoes por chamadas Prisma quando a BD estiver configurada.
 */

import crypto from 'crypto';

// Tipos internos (reflectem os modelos Prisma)

export type Role = 'STUDENT' | 'TEACHER' | 'TECHNICIAN' | 'COORDINATOR' | 'ADMIN' | 'FINANCE';
export type RoomType = 'CLASSROOM' | 'LAB' | 'AUDITORIUM' | 'OFFICE' | 'OTHER';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MaintenanceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HARDWARE'
  | 'FURNITURE'
  | 'HVAC'
  | 'CLEANING'
  | 'OTHER';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  studentId?: string;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredBuilding {
  id: string;
  code: string;
  name: string;
  address: string;
  floors: number;
  createdAt: Date;
}

export interface StoredRoom {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  floor: number;
  capacity: number;
  isAvailable: boolean;
  type: RoomType;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredIncident {
  id: string;
  title: string;
  description: string;
  roomId: string;
  reportedById: string;
  assignedToId?: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredMaintenanceNote {
  id: string;
  requestId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface StoredMaintenanceRequest {
  id: string;
  code: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  roomId: string;
  reportedById: string;
  assignedToId?: string;
  estimatedCost?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredAuditEvent {
  id: string;
  correlationId: string;
  userId: string;
  action: string;
  module: string;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
}

// Dados de seed

export const users: StoredUser[] = [
  {
    id: 'usr_demo_admin_01',
    name: 'Alipio Paco',
    email: 'admin@smartcampus.demo',
    passwordHash: 'Admin123!',
    role: 'ADMIN',
    department: 'Informatica e Tecnologia',
    isActive: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: 'usr_admin_01',
    name: 'Administrador Geral',
    email: 'admin@ujac.ac.mz',
    passwordHash: '123456',
    role: 'ADMIN',
    department: 'Direcao TIC',
    isActive: true,
    createdAt: new Date('2026-09-10'),
    updatedAt: new Date('2026-09-10'),
  },
  {
    id: 'usr_finance_01',
    name: 'Gestor Financeiro',
    email: 'financas@ujac.ac.mz',
    passwordHash: '123456',
    role: 'FINANCE',
    department: 'Direcao Financeira e Contabilidade',
    isActive: true,
    createdAt: new Date('2026-09-10'),
    updatedAt: new Date('2026-09-10'),
  },
  {
    id: 'usr_coord_01',
    name: 'Armando Correia',
    email: 'armando.correia@smartcampus.demo',
    passwordHash: 'Admin123!',
    role: 'COORDINATOR',
    department: 'Engenharia de Software',
    isActive: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: 'usr_tech_01',
    name: 'Jocar Elias',
    email: 'jocar.elias@smartcampus.demo',
    passwordHash: 'Admin123!',
    role: 'TECHNICIAN',
    department: 'Servicos Tecnicos',
    isActive: true,
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: 'usr_demo_student_01',
    name: 'Maria Fernanda',
    email: 'maria.fernanda@smartcampus.demo',
    passwordHash: 'Admin123!',
    role: 'STUDENT',
    studentId: '2024080010',
    department: 'Engenharia Informatica',
    isActive: true,
    createdAt: new Date('2026-02-10'),
    updatedAt: new Date('2026-02-10'),
  },
  {
    id: 'usr_student_01',
    name: 'Alipio Anderson Moises Paco',
    email: 'alipio.paco@estudante.ujac.ac.mz',
    passwordHash: '123456',
    role: 'STUDENT',
    studentId: '2024080003',
    department: 'Engenharia Informatica',
    isActive: true,
    createdAt: new Date('2026-09-10'),
    updatedAt: new Date('2026-09-10'),
  },
  {
    id: 'usr_student_02',
    name: 'Josefa Muthemba',
    email: 'josefa.muthemba@estudante.ujac.ac.mz',
    passwordHash: '123456',
    role: 'STUDENT',
    studentId: '2024080038',
    department: 'Engenharia Informatica',
    isActive: true,
    createdAt: new Date('2026-09-10'),
    updatedAt: new Date('2026-09-10'),
  },
  {
    id: 'usr_teacher_01',
    name: 'Carlos Manuel',
    email: 'carlos.manuel@smartcampus.demo',
    passwordHash: 'Admin123!',
    role: 'TEACHER',
    department: 'Matematica e Ciencias',
    isActive: true,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
  },
];

export const buildings: StoredBuilding[] = [
  {
    id: 'bld_a_01',
    code: 'BLOCO-A',
    name: 'Bloco A — Engenharia e Tecnologia',
    address: 'Campus Central, UJAC',
    floors: 3,
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'bld_b_01',
    code: 'BLOCO-B',
    name: 'Bloco B — Ciencias e Humanidades',
    address: 'Campus Central, UJAC',
    floors: 2,
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'bld_c_01',
    code: 'BLOCO-C',
    name: 'Bloco C — Administracao e Biblioteca',
    address: 'Campus Norte, UJAC',
    floors: 4,
    createdAt: new Date('2026-01-01'),
  },
];

export const rooms: StoredRoom[] = [
  {
    id: 'room_01',
    code: 'LAB-INF-01',
    name: 'Laboratorio de Engenharia de Software',
    buildingId: 'bld_a_01',
    floor: 1,
    capacity: 40,
    isAvailable: true,
    type: 'LAB',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  },
  {
    id: 'room_02',
    code: 'SALA-A204',
    name: 'Sala de Aulas PTP III',
    buildingId: 'bld_a_01',
    floor: 2,
    capacity: 65,
    isAvailable: true,
    type: 'CLASSROOM',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  },
  {
    id: 'room_03',
    code: 'AUD-NOBRE',
    name: 'Auditorio Principal UJAC',
    buildingId: 'bld_c_01',
    floor: 0,
    capacity: 250,
    isAvailable: false,
    type: 'AUDITORIUM',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  },
  {
    id: 'room_04',
    code: 'LAB-REDES-01',
    name: 'Laboratorio de Redes e Sistemas',
    buildingId: 'bld_a_01',
    floor: 3,
    capacity: 30,
    isAvailable: true,
    type: 'LAB',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  },
];

export const incidents: StoredIncident[] = [
  {
    id: 'inc_01',
    title: 'Projector nao funciona no LAB-INF-01',
    description: 'O projector da sala de laboratorio nao da sinal de energia desde segunda-feira.',
    roomId: 'room_01',
    reportedById: 'usr_demo_student_01',
    status: 'OPEN',
    priority: 'HIGH',
    createdAt: new Date('2026-08-25'),
    updatedAt: new Date('2026-08-25'),
  },
  {
    id: 'inc_02',
    title: 'Ar condicionado com avaria no Auditorio',
    description: 'O sistema de ar condicionado esta a fazer barulho excessivo e nao arrefece.',
    roomId: 'room_03',
    reportedById: 'usr_teacher_01',
    assignedToId: 'usr_tech_01',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: new Date('2026-08-20'),
    updatedAt: new Date('2026-08-22'),
  },
];

export const maintenanceNotes: StoredMaintenanceNote[] = [
  {
    id: 'note_01',
    requestId: 'mnt_01',
    authorId: 'usr_tech_01',
    content: 'Inspeccao inicial efectuada. Identificada falha no disjuntor de proteccao.',
    createdAt: new Date('2026-08-26T10:00:00Z'),
  },
];

export const maintenanceRequests: StoredMaintenanceRequest[] = [
  {
    id: 'mnt_01',
    code: 'MN-2026-001',
    title: 'Quadro Eletrico Principal a Disparar',
    description: 'Ao ligar os 40 computadores do LAB-INF-01, o disjuntor principal da sala dispara.',
    category: 'ELECTRICAL',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    roomId: 'room_01',
    reportedById: 'usr_teacher_01',
    assignedToId: 'usr_tech_01',
    estimatedCost: 1500,
    createdAt: new Date('2026-08-26T08:00:00Z'),
    updatedAt: new Date('2026-08-26T10:00:00Z'),
  },
  {
    id: 'mnt_02',
    code: 'MN-2026-002',
    title: 'Fuga de Agua na Torneira do W.C.',
    description: 'Torneira do sanitario masculino no Bloco A com fuga constante.',
    category: 'PLUMBING',
    priority: 'MEDIUM',
    status: 'OPEN',
    roomId: 'room_02',
    reportedById: 'usr_demo_student_01',
    createdAt: new Date('2026-08-27T07:00:00Z'),
    updatedAt: new Date('2026-08-27T07:00:00Z'),
  },
  {
    id: 'mnt_03',
    code: 'MN-2026-003',
    title: 'Substituicao de Lampadas LED',
    description: 'Tres lampadas tubulares LED fundidas na Sala A204.',
    category: 'ELECTRICAL',
    priority: 'LOW',
    status: 'RESOLVED',
    roomId: 'room_02',
    reportedById: 'usr_coord_01',
    assignedToId: 'usr_tech_01',
    resolvedAt: new Date('2026-08-26T16:00:00Z'),
    createdAt: new Date('2026-08-24T14:00:00Z'),
    updatedAt: new Date('2026-08-26T16:00:00Z'),
  },
];

export const auditEvents: StoredAuditEvent[] = [
  {
    id: 'aud_01',
    correlationId: crypto.randomUUID(),
    userId: 'usr_demo_admin_01',
    action: 'USER_LOGIN',
    module: 'auth',
    resourceId: 'usr_demo_admin_01',
    payload: { email: 'admin@smartcampus.demo', ip: '127.0.0.1' },
    createdAt: new Date('2026-08-27T06:00:00Z'),
  },
  {
    id: 'aud_02',
    correlationId: crypto.randomUUID(),
    userId: 'usr_demo_student_01',
    action: 'MAINTENANCE_REQUEST_CREATED',
    module: 'maintenance',
    resourceId: 'mnt_02',
    payload: { title: 'Fuga de Agua na Torneira do W.C.', category: 'PLUMBING' },
    createdAt: new Date('2026-08-27T07:00:00Z'),
  },
];

export const refreshTokens: StoredRefreshToken[] = [];
