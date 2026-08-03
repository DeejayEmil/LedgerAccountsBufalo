import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import {
  LedgerTransaction,
  TransactionType,
} from './entities/ledger-transaction.entity';
import { RedisService } from '../redis/redis.service';
import { TransactionFilterInput } from './dto/transaction-filter.input';
import { BalanceSummaryModel } from './dto/balance-summary.model';
import { PaginatedTransactionsModel } from './dto/paginated-transactions.model';
import { TransferResultModel } from './dto/transfer-result.model';
import { BalanceHistoryPointModel } from './dto/balance-history-point.model';

const BALANCE_SUMMARY_CACHE_TTL_SECONDS = 30;

function toCents(amount: string): bigint {
  // Evitamos aritmética de punto flotante para dinero: trabajamos en
  // centavos como bigint. Asume máximo 2 decimales (ya validado en el DTO
  // vía @IsNumberString + el chequeo explícito de abajo).
  const [whole, decimal = ''] = amount.split('.');
  const paddedDecimal = (decimal + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(paddedDecimal || '0');
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const decimal = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${decimal}`;
}

function balanceSummaryCacheKey(accountId: string): string {
  return `balance-summary:${accountId}`;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LedgerTransaction)
    private readonly transactionsRepository: Repository<LedgerTransaction>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Registra un movimiento de crédito/débito de forma atómica:
   *  1. Toma un lock pesimista (SELECT ... FOR UPDATE) sobre la cuenta para
   *     serializar escrituras concurrentes sobre el mismo balance.
   *  2. Valida propiedad de la cuenta, monto positivo y saldo suficiente
   *     para débitos.
   *  3. Actualiza el balance y crea la entrada del ledger en la misma
   *     transacción de base de datos: o se aplican ambos cambios, o ninguno.
   */
  async createTransaction(params: {
    userId: string;
    accountId: string;
    type: TransactionType;
    amount: string;
    description?: string;
  }): Promise<LedgerTransaction> {
    const amountCents = this.parsePositiveAmount(params.amount);

    const result = await this.dataSource.transaction(async (manager) => {
      const account = await manager
        .createQueryBuilder(Account, 'account')
        .setLock('pessimistic_write')
        .where('account.id = :id', { id: params.accountId })
        .getOne();

      if (!account) {
        throw new NotFoundException('Cuenta no encontrada');
      }

      if (account.ownerId !== params.userId) {
        throw new ForbiddenException('No tienes acceso a esta cuenta');
      }

      const currentBalanceCents = toCents(account.balance);
      const newBalanceCents =
        params.type === TransactionType.CREDIT
          ? currentBalanceCents + amountCents
          : currentBalanceCents - amountCents;

      if (params.type === TransactionType.DEBIT && newBalanceCents < 0n) {
        throw new BadRequestException(
          `Saldo insuficiente: balance actual ${account.balance}, se intentó debitar ${params.amount}`,
        );
      }

      account.balance = fromCents(newBalanceCents);
      await manager.save(Account, account);

      const transaction = manager.create(LedgerTransaction, {
        accountId: account.id,
        type: params.type,
        amount: fromCents(amountCents),
        balanceAfter: account.balance,
        description: params.description ?? null,
      });

      return manager.save(LedgerTransaction, transaction);
    });

    // Invalidamos el cache de resumen: el dato quedó obsoleto en cuanto se
    // confirmó la transacción.
    await this.redisService.del(balanceSummaryCacheKey(params.accountId));

    return result;
  }

  /**
   * Transfiere dinero de una cuenta propia a la cuenta de CUALQUIER usuario
   * (identificada por número de cuenta), de forma atómica: un débito en el
   * origen y un crédito en el destino se confirman juntos o no se confirma
   * ninguno.
   *
   * Para evitar deadlocks cuando dos transferencias corren al mismo tiempo
   * en direcciones opuestas (A→B y B→A), las dos cuentas se bloquean
   * siempre en el mismo orden determinístico (por id), sin importar cuál es
   * el origen y cuál el destino en esta llamada en particular.
   */
  async transferToAccount(params: {
    userId: string;
    fromAccountId: string;
    toAccountNumber: string;
    amount: string;
    description?: string;
  }): Promise<TransferResultModel> {
    const amountCents = this.parsePositiveAmount(params.amount);
    let destinationAccountId = '';

    const result = await this.dataSource.transaction(async (manager) => {
      const destinationLookup = await manager
        .createQueryBuilder(Account, 'account')
        .where('account.accountNumber = :accountNumber', {
          accountNumber: params.toAccountNumber,
        })
        .getOne();

      if (!destinationLookup) {
        throw new NotFoundException(
          `No existe ninguna cuenta con el número ${params.toAccountNumber}`,
        );
      }

      if (destinationLookup.id === params.fromAccountId) {
        throw new BadRequestException(
          'No puedes transferir dinero a la misma cuenta de origen',
        );
      }

      const idsInLockOrder = [
        params.fromAccountId,
        destinationLookup.id,
      ].sort();
      const lockedAccounts = await manager
        .createQueryBuilder(Account, 'account')
        .setLock('pessimistic_write')
        .where('account.id IN (:...ids)', { ids: idsInLockOrder })
        .orderBy('account.id', 'ASC')
        .getMany();

      const source = lockedAccounts.find((a) => a.id === params.fromAccountId);
      const destination = lockedAccounts.find(
        (a) => a.id === destinationLookup.id,
      );

      if (!source) {
        throw new NotFoundException('Cuenta de origen no encontrada');
      }
      if (source.ownerId !== params.userId) {
        throw new ForbiddenException('No tienes acceso a esta cuenta');
      }
      if (!destination) {
        throw new NotFoundException('Cuenta destino no encontrada');
      }

      const sourceBalanceCents = toCents(source.balance);
      if (sourceBalanceCents - amountCents < 0n) {
        throw new BadRequestException(
          `Saldo insuficiente: balance actual ${source.balance}, se intentó transferir ${params.amount}`,
        );
      }

      source.balance = fromCents(sourceBalanceCents - amountCents);
      destination.balance = fromCents(
        toCents(destination.balance) + amountCents,
      );
      await manager.save(Account, [source, destination]);

      const maskedSource = `****${source.accountNumber.slice(-4)}`;
      const maskedDestination = `****${destination.accountNumber.slice(-4)}`;

      const debitEntry = manager.create(LedgerTransaction, {
        accountId: source.id,
        type: TransactionType.DEBIT,
        amount: fromCents(amountCents),
        balanceAfter: source.balance,
        description:
          params.description ?? `Transferencia a cuenta ${maskedDestination}`,
      });
      const creditEntry = manager.create(LedgerTransaction, {
        accountId: destination.id,
        type: TransactionType.CREDIT,
        amount: fromCents(amountCents),
        balanceAfter: destination.balance,
        description:
          params.description ?? `Transferencia de cuenta ${maskedSource}`,
      });

      const [savedDebit] = await manager.save(LedgerTransaction, [
        debitEntry,
        creditEntry,
      ]);

      destinationAccountId = destination.id;

      return {
        sourceTransaction: savedDebit,
        toAccountNumber: destination.accountNumber,
      };
    });

    // Ambos balances cambiaron: el resumen cacheado de las dos cuentas
    // quedó obsoleto en cuanto se confirmó la transferencia.
    await Promise.all([
      this.redisService.del(balanceSummaryCacheKey(params.fromAccountId)),
      this.redisService.del(balanceSummaryCacheKey(destinationAccountId)),
    ]);

    return result;
  }

  /**
   * Historial de balance: un punto por cada día (dentro de la ventana
   * pedida) que tuvo al menos un movimiento, con el balance de cierre de
   * ese día. No rellena los días sin movimientos — el cliente decide cómo
   * dibujar los huecos (ej. arrastrando el último valor conocido).
   */
  async getBalanceHistory(
    userId: string,
    accountId: string,
    days: number,
    getOwnedAccount: (userId: string, accountId: string) => Promise<Account>,
  ): Promise<BalanceHistoryPointModel[]> {
    await getOwnedAccount(userId, accountId);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const transactions = await this.transactionsRepository.find({
      where: { accountId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
    });

    // Un Map preserva orden de inserción; como iteramos ASC, la última
    // escritura para una fecha dada es siempre el balance de cierre de ese día.
    const closingBalanceByDay = new Map<string, string>();
    for (const tx of transactions) {
      const dayKey = tx.createdAt.toISOString().slice(0, 10);
      closingBalanceByDay.set(dayKey, tx.balanceAfter);
    }

    return Array.from(closingBalanceByDay.entries()).map(
      ([date, closingBalance]) => ({
        date,
        closingBalance,
      }),
    );
  }

  async listTransactions(
    userId: string,
    filter: TransactionFilterInput,
    getOwnedAccount: (userId: string, accountId: string) => Promise<Account>,
  ): Promise<PaginatedTransactionsModel> {
    await getOwnedAccount(userId, filter.accountId);

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const where: Record<string, unknown> = { accountId: filter.accountId };
    if (filter.type) {
      where.type = filter.type;
    }
    if (filter.dateFrom && filter.dateTo) {
      where.createdAt = Between(
        new Date(filter.dateFrom),
        this.endOfDay(filter.dateTo),
      );
    } else if (filter.dateFrom) {
      where.createdAt = MoreThanOrEqual(new Date(filter.dateFrom));
    } else if (filter.dateTo) {
      where.createdAt = LessThanOrEqual(this.endOfDay(filter.dateTo));
    }

    const [items, total] = await this.transactionsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getBalanceSummary(
    userId: string,
    accountId: string,
    getOwnedAccount: (userId: string, accountId: string) => Promise<Account>,
  ): Promise<BalanceSummaryModel> {
    const account = await getOwnedAccount(userId, accountId);

    const cacheKey = balanceSummaryCacheKey(accountId);
    const cached =
      await this.redisService.getJson<BalanceSummaryModel>(cacheKey);
    if (cached) {
      return cached;
    }

    const aggregate = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('tx.type', 'type')
      .addSelect('SUM(tx.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('tx.accountId = :accountId', { accountId })
      .groupBy('tx.type')
      .getRawMany<{ type: TransactionType; total: string; count: string }>();

    const credit = aggregate.find((row) => row.type === TransactionType.CREDIT);
    const debit = aggregate.find((row) => row.type === TransactionType.DEBIT);

    const summary: BalanceSummaryModel = {
      accountId,
      currentBalance: account.balance,
      totalCredits: credit?.total ?? '0.00',
      totalDebits: debit?.total ?? '0.00',
      transactionCount: Number(credit?.count ?? 0) + Number(debit?.count ?? 0),
    };

    await this.redisService.setJson(
      cacheKey,
      summary,
      BALANCE_SUMMARY_CACHE_TTL_SECONDS,
    );

    return summary;
  }

  private parsePositiveAmount(amount: string): bigint {
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException(
        'amount debe ser un decimal positivo con hasta 2 decimales, ej. "150.00"',
      );
    }
    const cents = toCents(amount);
    if (cents <= 0n) {
      throw new BadRequestException('amount debe ser mayor que 0');
    }
    return cents;
  }

  private endOfDay(dateStr: string): Date {
    const date = new Date(dateStr);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }
}
