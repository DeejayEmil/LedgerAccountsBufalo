import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { TransactionType } from '../entities/ledger-transaction.entity';

registerEnumType(TransactionType, { name: 'TransactionType' });

@ObjectType('Transaction')
export class TransactionModel {
  @Field(() => ID)
  id: string;

  @Field()
  accountId: string;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field()
  amount: string;

  @Field()
  balanceAfter: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field()
  createdAt: Date;
}
