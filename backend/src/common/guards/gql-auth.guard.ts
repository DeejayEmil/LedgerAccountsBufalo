import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Guard JWT que funciona tanto para resolvers GraphQL como para
 * controladores REST. Passport necesita un `Request` "de verdad"; en
 * contexto GraphQL lo extraemos del contexto de Apollo.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    if (ctx?.req) {
      return ctx.req;
    }
    return context.switchToHttp().getRequest();
  }
}
