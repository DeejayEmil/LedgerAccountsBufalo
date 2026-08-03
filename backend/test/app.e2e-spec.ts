import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Test de integración end-to-end sobre HTTP real (auth vía REST,
 * dominio vía GraphQL), tal como lo consumiría el cliente móvil.
 *
 * Requiere Postgres y Redis corriendo (ver docker-compose.yml):
 *   docker compose up -d
 *   npm run test:e2e
 */
describe('Accounts & Ledger (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let accountId: string;

  const uniqueEmail = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra un usuario nuevo y devuelve un access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Str0ngP@ssword',
        fullName: 'E2E Tester',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(uniqueEmail);
    accessToken = res.body.accessToken;
  });

  it('rechaza el registro con un email duplicado', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Str0ngP@ssword',
        fullName: 'E2E Tester',
      })
      .expect(409);
  });

  it('rechaza login con credenciales inválidas', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: uniqueEmail, password: 'incorrecta' })
      .expect(401);
  });

  it('rechaza queries GraphQL sin autenticación', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ accounts { id } }' });

    expect(res.body.errors).toBeDefined();
  });

  it('crea una cuenta vía GraphQL', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `mutation { createAccount(input: {}) { id accountNumber balance currency } }`,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createAccount.balance).toBe('0.00');
    accountId = res.body.data.createAccount.id;
  });

  it('registra un crédito y refleja el nuevo balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `mutation($input: CreateTransactionInput!) {
          createTransaction(input: $input) { balanceAfter type amount }
        }`,
        variables: {
          input: {
            accountId,
            type: 'CREDIT',
            amount: '200.00',
            description: 'Depósito inicial',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createTransaction.balanceAfter).toBe('200.00');
  });

  it('rechaza un débito que excede el balance disponible', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `mutation($input: CreateTransactionInput!) {
          createTransaction(input: $input) { balanceAfter }
        }`,
        variables: { input: { accountId, type: 'DEBIT', amount: '9999.00' } },
      })
      .expect(200);

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/Saldo insuficiente/);
  });

  it('lista transacciones paginadas de la cuenta', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `query($filter: TransactionFilterInput!) {
          transactions(filter: $filter) { total page limit items { type amount } }
        }`,
        variables: { filter: { accountId, page: 1, limit: 10 } },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.transactions.total).toBeGreaterThanOrEqual(1);
  });

  it('devuelve el resumen de balance con totales correctos', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `query($accountId: String!) {
          balanceSummary(accountId: $accountId) {
            currentBalance totalCredits totalDebits transactionCount
          }
        }`,
        variables: { accountId },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.balanceSummary.currentBalance).toBe('200.00');
    expect(res.body.data.balanceSummary.totalCredits).toBe('200.00');
  });

  it('devuelve el historial de balance con al menos un punto', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `query($accountId: String!, $days: Int) {
          balanceHistory(accountId: $accountId, days: $days) { date closingBalance }
        }`,
        variables: { accountId, days: 30 },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.balanceHistory.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.balanceHistory[0].closingBalance).toBe('200.00');
  });

  it('actualiza el avatar del usuario', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `mutation($avatarUrl: String!) {
          updateAvatar(avatarUrl: $avatarUrl) { id avatarUrl }
        }`,
        variables: { avatarUrl: 'data:image/png;base64,AAAA' },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.updateAvatar.avatarUrl).toBe(
      'data:image/png;base64,AAAA',
    );
  });
});

describe('Transferencias entre usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let senderToken: string;
  let senderAccountId: string;
  let receiverToken: string;
  let receiverAccountNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const senderEmail = `sender-${Date.now()}@example.com`;
    const receiverEmail = `receiver-${Date.now()}@example.com`;

    const senderRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: senderEmail,
        password: 'Str0ngP@ssword',
        fullName: 'Sender',
      });
    senderToken = senderRes.body.accessToken;

    const receiverRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: receiverEmail,
        password: 'Str0ngP@ssword',
        fullName: 'Receiver',
      });
    receiverToken = receiverRes.body.accessToken;

    const senderAccountRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        query: `mutation { createAccount(input: {}) { id accountNumber } }`,
      });
    senderAccountId = senderAccountRes.body.data.createAccount.id;

    const receiverAccountRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({
        query: `mutation { createAccount(input: {}) { id accountNumber } }`,
      });
    receiverAccountNumber =
      receiverAccountRes.body.data.createAccount.accountNumber;

    // Fondea la cuenta del que envía.
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        query: `mutation($input: CreateTransactionInput!) { createTransaction(input: $input) { id } }`,
        variables: {
          input: {
            accountId: senderAccountId,
            type: 'CREDIT',
            amount: '500.00',
          },
        },
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('transfiere dinero a la cuenta de otro usuario y refleja el balance en ambos lados', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        query: `mutation($input: TransferInput!) {
          transferToAccount(input: $input) {
            sourceTransaction { balanceAfter type }
            toAccountNumber
          }
        }`,
        variables: {
          input: {
            fromAccountId: senderAccountId,
            toAccountNumber: receiverAccountNumber,
            amount: '150.00',
            description: 'Pago compartido',
          },
        },
      })
      .expect(200);

    expect(transferRes.body.errors).toBeUndefined();
    expect(
      transferRes.body.data.transferToAccount.sourceTransaction.balanceAfter,
    ).toBe('350.00');
    expect(transferRes.body.data.transferToAccount.sourceTransaction.type).toBe(
      'DEBIT',
    );

    const receiverBalanceRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ query: `{ accounts { balance } }` })
      .expect(200);

    expect(receiverBalanceRes.body.data.accounts[0].balance).toBe('150.00');
  });

  it('rechaza transferir a un número de cuenta inexistente', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        query: `mutation($input: TransferInput!) { transferToAccount(input: $input) { toAccountNumber } }`,
        variables: {
          input: {
            fromAccountId: senderAccountId,
            toAccountNumber: '0000000000',
            amount: '10.00',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeDefined();
  });
});
