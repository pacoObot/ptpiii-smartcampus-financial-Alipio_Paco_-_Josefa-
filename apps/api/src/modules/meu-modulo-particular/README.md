# 🚀 Espaço do Vosso Módulo Particular — Smart Campus (Semana 3)

Este directório é o espaço reservado para a implementação do módulo particular do vosso grupo (ex: `maintenance`, `academic`, `iot-sensors`, `parking`, `notifications`, etc.).

---

## 📂 Ficheiros Sugeridos Nesta Pasta

- `modulo.controller.ts`: Lógica dos endpoints e tratamento de pedidos/respostas.
- `modulo.service.ts`: Lógica de negócio e comunicação com a base de dados via Prisma.
- `modulo.routes.ts`: Definição de rotas Express e aplicação dos middlewares `authenticate` e `authorize`.

---

## 📝 Passos para Activação

1. Renomeiem esta pasta para o nome do vosso módulo (ex: `maintenance`).
2. Implementem as regras em `modulo.service.ts` e `modulo.controller.ts`.
3. Importem e registem as rotas em `apps/api/src/routes/v1.ts`:
   ```typescript
   import meuModuloRouter from '../modules/<nome-do-modulo>/modulo.routes';
   router.use('/<nome-do-modulo>', meuModuloRouter);
   ```
4. Actualizem o catálogo do Frontend React em `apps/web/src/modules/catalog.ts`.
