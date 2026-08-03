import { Field, Int, ObjectType } from '@nestjs/graphql';
import { TransactionModel } from './transaction.model';

@ObjectType('PaginatedTransactions')
export class PaginatedTransactionsModel {
  @Field(() => [TransactionModel])
  items: TransactionModel[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}
