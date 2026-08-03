import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { AccountType } from '../entities/account.entity';

@InputType()
export class CreateAccountInput {
  @Field(() => AccountType, {
    nullable: true,
    defaultValue: AccountType.CHECKING,
  })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @Field({ nullable: true, defaultValue: 'USD' })
  @IsOptional()
  @IsIn(['USD', 'EUR', 'MXN'], {
    message: 'Moneda no soportada. Usa USD, EUR o MXN.',
  })
  currency?: string;
}
