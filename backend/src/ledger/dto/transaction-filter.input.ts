import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TransactionType } from '../entities/ledger-transaction.entity';

@InputType()
export class TransactionFilterInput {
  @Field(() => ID)
  @IsString()
  accountId: string;

  @Field(() => TransactionType, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @Field({ nullable: true, description: 'ISO 8601, ej. 2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @Field({ nullable: true, description: 'ISO 8601, ej. 2026-01-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
