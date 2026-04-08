import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePixKeyDto {
  @IsString()
  @MaxLength(255)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;
}
