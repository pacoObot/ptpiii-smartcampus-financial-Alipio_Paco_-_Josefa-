import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { correlationIdMiddleware } from './middlewares/correlationId';
import { errorHandlerMiddleware } from './middlewares/errorHandler';
import { swaggerDocument } from './config/swagger';
import v1Router from './routes/v1';

const app: Express = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);

// Rota de Health Check (Fora de /api/v1)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'Smart Campus Core API',
  });
});

// Documentacao Swagger UI (http://localhost:4100/api/docs)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Router de API v1
app.use('/api/v1', v1Router);

// Middleware Global de Tratamento de Erros
app.use(errorHandlerMiddleware);

export default app;
