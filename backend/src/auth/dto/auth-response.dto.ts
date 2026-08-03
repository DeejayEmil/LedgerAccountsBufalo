import { ApiProperty } from '@nestjs/swagger';

export class UserPublicDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserPublicDto })
  user: UserPublicDto;
}
