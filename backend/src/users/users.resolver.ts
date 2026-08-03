import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { UserModel } from './dto/user.model';

@Resolver(() => UserModel)
@UseGuards(GqlAuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserModel, { name: 'me' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserModel> {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return fullUser;
  }

  @Mutation(() => UserModel, { name: 'updateAvatar' })
  async updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Args('avatarUrl') avatarUrl: string,
  ): Promise<UserModel> {
    return this.usersService.updateAvatar(user.id, avatarUrl);
  }
}
