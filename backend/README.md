# QikBanco — Backend (NestJS)

Ver el [README principal del repo](../README.md) para la descripción completa del proyecto, arquitectura y decisiones de diseño.

## Quickstart

```bash
cp .env.example .env
docker compose up -d   # Postgres + Redis
npm install
npm run start:dev
```

- GraphQL Playground: http://localhost:3000/graphql
- Swagger (auth REST): http://localhost:3000/api/docs

## Tests

```bash
npm test          # unitarios
npm run test:e2e  # integración (levanta un Postgres embebido, no requiere Docker)
```
