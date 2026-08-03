import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AccountType } from '../entities/account.entity';

registerEnumType(AccountType, { name: 'AccountType' });

@ObjectType('Account')
export class AccountModel {
  @Field()
  id: string;

  @Field()
  accountNumber: string;

  @Field(() => AccountType)
  type: AccountType;

  @Field()
  currency: string;

  // String en vez de Float: un Float de GraphQL/JS puede perder precisión
  // en montos de dinero. El cliente parsea el string a decimal.
  @Field()
  balance: string;

  @Field()
  createdAt: Date;
}
