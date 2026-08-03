import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('BalanceHistoryPoint')
export class BalanceHistoryPointModel {
  // Fecha en formato ISO (yyyy-mm-dd), en UTC.
  @Field()
  date: string;

  // Balance de cierre de ese día (el balanceAfter del último movimiento
  // registrado ese día).
  @Field()
  closingBalance: string;
}
