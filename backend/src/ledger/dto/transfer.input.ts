import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

@InputType()
export class TransferInput {
  @Field(() => ID)
  @IsString()
  fromAccountId: string;

  @Field()
  @IsString()
  @Length(10, 10, {
    message: 'El número de cuenta destino debe tener 10 dígitos',
  })
  toAccountNumber: string;

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
