import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TransactionType } from '../entities/ledger-transaction.entity';

@InputType()
export class CreateTransactionInput {
  @Field(() => ID)
  @IsString()
  accountId: string;

  @Field(() => TransactionType)
  @IsEnum(TransactionType)
  type: TransactionType;

  // String, no Float: validamos manualmente que sea un decimal positivo
  // (ver LedgerService) para evitar los problemas de precisión de punto
  // flotante en montos de dinero.
  @Field()
  @IsNumberString(
    {},
    { message: 'amount debe ser un número decimal, ej. "150.00"' },
  )
  amount: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
