import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AccountsService } from './accounts.service';
import { AccountModel } from './dto/account.model';
import { CreateAccountInput } from './dto/create-account.input';

@Resolver(() => AccountModel)
@UseGuards(GqlAuthGuard)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Query(() => [AccountModel], { name: 'accounts' })
  async listAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountModel[]> {
    return this.accountsService.listByOwner(user.id);
  }

  @Query(() => AccountModel, { name: 'account' })
  async getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AccountModel> {
    return this.accountsService.getOwnedAccount(user.id, id);
  }

  @Mutation(() => AccountModel, { name: 'createAccount' })
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateAccountInput,
  ): Promise<AccountModel> {
    return this.accountsService.createAccount(user.id, input);
  }
}
