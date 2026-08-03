import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { LedgerService } from './ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../notifications/email.service';
import { TransactionModel } from './dto/transaction.model';
import { CreateTransactionInput } from './dto/create-transaction.input';
import { TransactionFilterInput } from './dto/transaction-filter.input';
import { PaginatedTransactionsModel } from './dto/paginated-transactions.model';
import { BalanceSummaryModel } from './dto/balance-summary.model';
import { TransferInput } from './dto/transfer.input';
import { TransferResultModel } from './dto/transfer-result.model';
import { BalanceHistoryPointModel } from './dto/balance-history-point.model';

@Resolver(() => TransactionModel)
@UseGuards(GqlAuthGuard)
export class LedgerResolver {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Mutation(() => TransactionModel, { name: 'createTransaction' })
  async createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateTransactionInput,
  ): Promise<TransactionModel> {
    const transaction = await this.ledgerService.createTransaction({
      userId: user.id,
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      description: input.description,
    });

    const account = await this.accountsService.getOwnedAccount(
      user.id,
      input.accountId,
    );
    await this.emailService.sendTransactionReceipt(user.email, {
      type: transaction.type,
      amount: transaction.amount,
      currency: account.currency,
      balanceAfter: transaction.balanceAfter,
      accountNumber: account.accountNumber,
      description: transaction.description,
    });

    return transaction;
  }

  @Mutation(() => TransferResultModel, { name: 'transferToAccount' })
  async transferToAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: TransferInput,
  ): Promise<TransferResultModel> {
    const result = await this.ledgerService.transferToAccount({
      userId: user.id,
      fromAccountId: input.fromAccountId,
      toAccountNumber: input.toAccountNumber,
      amount: input.amount,
      description: input.description,
    });

    const sourceAccount = await this.accountsService.getOwnedAccount(
      user.id,
      input.fromAccountId,
    );

    // Correo al que envía.
    await this.emailService.sendTransactionReceipt(user.email, {
      type: 'TRANSFER_OUT',
      amount: result.sourceTransaction.amount,
      currency: sourceAccount.currency,
      balanceAfter: result.sourceTransaction.balanceAfter,
      accountNumber: sourceAccount.accountNumber,
      description: result.sourceTransaction.description,
      counterpartyAccountNumber: result.toAccountNumber,
    });

    // Correo al que recibe, si tiene cuenta con notificaciones (siempre,
    // en este dominio) — buscamos su email a partir de la cuenta destino.
    const destinationAccount = await this.accountsService.findByAccountNumber(
      result.toAccountNumber,
    );
    if (destinationAccount) {
      const recipient = await this.usersService.findById(
        destinationAccount.ownerId,
      );
      if (recipient) {
        await this.emailService.sendTransactionReceipt(recipient.email, {
          type: 'TRANSFER_IN',
          amount: result.sourceTransaction.amount,
          currency: destinationAccount.currency,
          balanceAfter: destinationAccount.balance,
          accountNumber: destinationAccount.accountNumber,
          description: result.sourceTransaction.description,
          counterpartyAccountNumber: sourceAccount.accountNumber,
        });
      }
    }

    return result;
  }

  @Query(() => PaginatedTransactionsModel, { name: 'transactions' })
  async listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Args('filter') filter: TransactionFilterInput,
  ): Promise<PaginatedTransactionsModel> {
    return this.ledgerService.listTransactions(
      user.id,
      filter,
      (userId, accountId) =>
        this.accountsService.getOwnedAccount(userId, accountId),
    );
  }

  @Query(() => BalanceSummaryModel, { name: 'balanceSummary' })
  async getBalanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Args('accountId') accountId: string,
  ): Promise<BalanceSummaryModel> {
    return this.ledgerService.getBalanceSummary(
      user.id,
      accountId,
      (userId, accId) => this.accountsService.getOwnedAccount(userId, accId),
    );
  }

  @Query(() => [BalanceHistoryPointModel], { name: 'balanceHistory' })
  async getBalanceHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Args('accountId') accountId: string,
    @Args('days', { type: () => Int, nullable: true, defaultValue: 30 })
    days: number,
  ): Promise<BalanceHistoryPointModel[]> {
    return this.ledgerService.getBalanceHistory(
      user.id,
      accountId,
      days,
      (userId, accId) => this.accountsService.getOwnedAccount(userId, accId),
    );
  }
}
