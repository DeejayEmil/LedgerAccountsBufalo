import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    if (ctx?.req?.user) {
      return ctx.req.user;
    }
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
