import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  newPassword!: string;
}
