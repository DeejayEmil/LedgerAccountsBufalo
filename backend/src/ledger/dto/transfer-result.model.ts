import { Field, ObjectType } from '@nestjs/graphql';
import { TransactionModel } from './transaction.model';

@ObjectType('TransferResult')
export class TransferResultModel {
  // La entrada de débito registrada en la cuenta de origen (la del que
  // envía). Su `balanceAfter` es el nuevo balance del que llama a la mutación.
  @Field(() => TransactionModel)
  sourceTransaction: TransactionModel;

  @Field()
  toAccountNumber: string;
}
