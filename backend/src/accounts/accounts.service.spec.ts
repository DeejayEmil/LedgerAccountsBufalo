import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account, AccountType } from './entities/account.entity';

describe('AccountsService', () => {
  let service: AccountsService;
  let repo: Partial<Repository<Account>>;

  const account: Account = {
    id: 'acc-1',
    accountNumber: '1234567890',
    type: AccountType.CHECKING,
    currency: 'USD',
    balance: '0.00',
    version: 1,
    ownerId: 'user-1',
    owner: undefined as unknown as Account['owner'],
    transactions: [],
    createdAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation((v) => v),
      save: jest
        .fn()
        .mockImplementation((v) => Promise.resolve({ id: 'acc-1', ...v })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    service = new AccountsService(repo as Repository<Account>);
  });

  it('crea una cuenta nueva con balance inicial en 0', async () => {
    const created = await service.createAccount('user-1', {});

    expect(created.balance).toBe('0.00');
    expect(created.ownerId).toBe('user-1');
    expect(created.accountNumber).toHaveLength(10);
  });

  it('reintenta la generación de número de cuenta si hay colisión', async () => {
    (repo.exists as jest.Mock)
      .mockResolvedValueOnce(true) // primer intento: colisión
      .mockResolvedValueOnce(false); // segundo intento: libre

    await service.createAccount('user-1', {});

    expect(repo.exists).toHaveBeenCalledTimes(2);
  });

  it('lista solo las cuentas del dueño', async () => {
    (repo.find as jest.Mock).mockResolvedValue([account]);

    const result = await service.listByOwner('user-1');

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user-1' } }),
    );
    expect(result).toEqual([account]);
  });

  it('lanza NotFoundException si la cuenta no existe', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getOwnedAccount('user-1', 'acc-x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanza ForbiddenException si la cuenta es de otro usuario', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      ...account,
      ownerId: 'otro',
    });

    await expect(service.getOwnedAccount('user-1', 'acc-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('devuelve la cuenta si pertenece al usuario', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(account);

    const result = await service.getOwnedAccount('user-1', 'acc-1');

    expect(result).toEqual(account);
  });
});
