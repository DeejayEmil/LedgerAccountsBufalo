import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('BalanceSummary')
export class BalanceSummaryModel {
  @Field()
  accountId: string;

  @Field()
  currentBalance: string;

  @Field()
  totalCredits: string;

  @Field()
  totalDebits: string;

  @Field(() => Int)
  transactionCount: number;
}
