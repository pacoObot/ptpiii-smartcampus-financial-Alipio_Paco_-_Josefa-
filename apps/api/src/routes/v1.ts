import { Router } from 'express';
import authRouter from '../modules/auth/http/authRouter';
import usersRouter from '../modules/users/http/usersRouter';
import buildingsRouter from '../modules/buildings/http/buildingsRouter';
import roomsRouter from '../modules/rooms/http/roomsRouter';
import incidentsRouter from '../modules/incidents/http/incidentsRouter';
import maintenanceRouter from '../modules/maintenance/http/maintenanceRouter';
import auditRouter from '../modules/audit/http/auditRouter';
import dashboardRouter from '../modules/dashboard/http/dashboardRouter';
import financialRouter from '../modules/financial/http/financialRouter';

const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/buildings', buildingsRouter);
v1Router.use('/rooms', roomsRouter);
v1Router.use('/incidents', incidentsRouter);
v1Router.use('/maintenance', maintenanceRouter);
v1Router.use('/audit-events', auditRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/financial', financialRouter);

export default v1Router;
