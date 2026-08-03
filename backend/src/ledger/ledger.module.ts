import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerTransaction } from './entities/ledger-transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { LedgerService } from './ledger.service';
import { LedgerResolver } from './ledger.resolver';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerTransaction, Account]),
    AccountsModule,
    UsersModule,
  ],
  providers: [LedgerService, LedgerResolver],
  exports: [LedgerService],
})
export class LedgerModule {}
