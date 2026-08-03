import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LedgerService } from './ledger.service';
import {
  LedgerTransaction,
  TransactionType,
} from './entities/ledger-transaction.entity';
import { Account, AccountType } from '../accounts/entities/account.entity';
import { RedisService } from '../redis/redis.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let dataSource: { transaction: jest.Mock };
  let manager: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let queryBuilder: {
    setLock: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    getOne: jest.Mock;
    getMany: jest.Mock;
  };
  let transactionsRepository: Partial<Repository<LedgerTransaction>>;
  let redisService: Partial<RedisService>;

  const baseAccount: Account = {
    id: 'acc-1',
    accountNumber: '1234567890',
    type: AccountType.CHECKING,
    currency: 'USD',
    balance: '100.00',
    version: 1,
    ownerId: 'user-1',
    owner: undefined as unknown as Account['owner'],
    transactions: [],
    createdAt: new Date(),
  };

  beforeEach(() => {
    queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
    };

    manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest
        .fn()
        .mockImplementation((_entity, value) => Promise.resolve(value)),
      create: jest
        .fn()
        .mockImplementation((_entity, value) => ({ id: 'tx-1', ...value })),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(manager)),
    };

    transactionsRepository = {
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    redisService = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new LedgerService(
      dataSource as unknown as DataSource,
      transactionsRepository as Repository<LedgerTransaction>,
      redisService as RedisService,
    );
  });

  describe('createTransaction', () => {
    it('aplica un crédito sumando al balance actual', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...baseAccount,
        balance: '100.00',
      });

      const result = await service.createTransaction({
        userId: 'user-1',
        accountId: 'acc-1',
        type: TransactionType.CREDIT,
        amount: '25.50',
      });

      expect(result.balanceAfter).toBe('125.50');
      expect(result.amount).toBe('25.50');
      expect(redisService.del).toHaveBeenCalledWith('balance-summary:acc-1');
    });

    it('aplica un débito restando del balance actual', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...baseAccount,
        balance: '100.00',
      });

      const result = await service.createTransaction({
        userId: 'user-1',
        accountId: 'acc-1',
        type: TransactionType.DEBIT,
        amount: '40.00',
      });

      expect(result.balanceAfter).toBe('60.00');
    });

    it('rechaza un débito que dejaría el balance en negativo', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...baseAccount,
        balance: '30.00',
      });

      await expect(
        service.createTransaction({
          userId: 'user-1',
          accountId: 'acc-1',
          type: TransactionType.DEBIT,
          amount: '30.01',
        }),
      ).rejects.toThrow(BadRequestException);

      // No debe haber persistido nada si la regla de negocio falla.
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('permite un débito que deja el balance exactamente en 0', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...baseAccount,
        balance: '30.00',
      });

      const result = await service.createTransaction({
        userId: 'user-1',
        accountId: 'acc-1',
        type: TransactionType.DEBIT,
        amount: '30.00',
      });

      expect(result.balanceAfter).toBe('0.00');
    });

    it('rechaza montos no positivos antes de tocar la base de datos', async () => {
      await expect(
        service.createTransaction({
          userId: 'user-1',
          accountId: 'acc-1',
          type: TransactionType.CREDIT,
          amount: '0',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza montos con formato inválido (no numérico)', async () => {
      await expect(
        service.createTransaction({
          userId: 'user-1',
          accountId: 'acc-1',
          type: TransactionType.CREDIT,
          amount: 'not-a-number',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la cuenta no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.createTransaction({
          userId: 'user-1',
          accountId: 'acc-does-not-exist',
          type: TransactionType.CREDIT,
          amount: '10.00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la cuenta pertenece a otro usuario', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...baseAccount,
        ownerId: 'otro-usuario',
      });

      await expect(
        service.createTransaction({
          userId: 'user-1',
          accountId: 'acc-1',
          type: TransactionType.CREDIT,
          amount: '10.00',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('transferToAccount', () => {
    const destinationAccount: Account = {
      ...baseAccount,
      id: 'acc-2',
      accountNumber: '9876543210',
      ownerId: 'user-2',
      balance: '50.00',
    };

    it('transfiere de la cuenta propia a la de otro usuario', async () => {
      queryBuilder.getOne.mockResolvedValue(destinationAccount);
      queryBuilder.getMany.mockResolvedValue([
        { ...baseAccount, balance: '100.00' },
        { ...destinationAccount, balance: '50.00' },
      ]);

      const result = await service.transferToAccount({
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountNumber: '9876543210',
        amount: '30.00',
      });

      expect(result.sourceTransaction.balanceAfter).toBe('70.00');
      expect(result.sourceTransaction.type).toBe(TransactionType.DEBIT);
      expect(result.toAccountNumber).toBe('9876543210');
      // Se guardan ambas cuentas (balances actualizados) y ambas entradas del ledger.
      expect(manager.save).toHaveBeenCalledWith(Account, expect.any(Array));
      expect(manager.save).toHaveBeenCalledWith(
        LedgerTransaction,
        expect.any(Array),
      );
      expect(redisService.del).toHaveBeenCalledWith('balance-summary:acc-1');
      expect(redisService.del).toHaveBeenCalledWith('balance-summary:acc-2');
    });

    it('rechaza transferir a un número de cuenta que no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.transferToAccount({
          userId: 'user-1',
          fromAccountId: 'acc-1',
          toAccountNumber: '0000000000',
          amount: '10.00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza transferir a la misma cuenta de origen', async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseAccount });

      await expect(
        service.transferToAccount({
          userId: 'user-1',
          fromAccountId: 'acc-1',
          toAccountNumber: baseAccount.accountNumber,
          amount: '10.00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el usuario no es dueño de la cuenta de origen', async () => {
      queryBuilder.getOne.mockResolvedValue(destinationAccount);
      queryBuilder.getMany.mockResolvedValue([
        { ...baseAccount, ownerId: 'otro-usuario' },
        destinationAccount,
      ]);

      await expect(
        service.transferToAccount({
          userId: 'user-1',
          fromAccountId: 'acc-1',
          toAccountNumber: '9876543210',
          amount: '10.00',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza una transferencia que excede el saldo disponible', async () => {
      queryBuilder.getOne.mockResolvedValue(destinationAccount);
      queryBuilder.getMany.mockResolvedValue([
        { ...baseAccount, balance: '20.00' },
        destinationAccount,
      ]);

      await expect(
        service.transferToAccount({
          userId: 'user-1',
          fromAccountId: 'acc-1',
          toAccountNumber: '9876543210',
          amount: '20.01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBalanceSummary', () => {
    it('calcula totales de créditos/débitos y cachea el resultado', async () => {
      const getOwnedAccount = jest
        .fn()
        .mockResolvedValue({ ...baseAccount, balance: '85.50' });
      const getRawMany = jest.fn().mockResolvedValue([
        { type: TransactionType.CREDIT, total: '125.50', count: '2' },
        { type: TransactionType.DEBIT, total: '40.00', count: '1' },
      ]);
      (transactionsRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany,
      });

      const summary = await service.getBalanceSummary(
        'user-1',
        'acc-1',
        getOwnedAccount,
      );

      expect(summary.currentBalance).toBe('85.50');
      expect(summary.totalCredits).toBe('125.50');
      expect(summary.totalDebits).toBe('40.00');
      expect(summary.transactionCount).toBe(3);
      expect(redisService.setJson).toHaveBeenCalledWith(
        'balance-summary:acc-1',
        expect.any(Object),
        30,
      );
    });

    it('devuelve el valor cacheado sin volver a agregar si hay cache hit', async () => {
      const cached = {
        accountId: 'acc-1',
        currentBalance: '85.50',
        totalCredits: '125.50',
        totalDebits: '40.00',
        transactionCount: 3,
      };
      (redisService.getJson as jest.Mock).mockResolvedValue(cached);
      const getOwnedAccount = jest.fn().mockResolvedValue(baseAccount);

      const summary = await service.getBalanceSummary(
        'user-1',
        'acc-1',
        getOwnedAccount,
      );

      expect(summary).toEqual(cached);
      expect(transactionsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
