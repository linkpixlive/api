import { ApiProperty } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty({ example: 'Operação realizada com sucesso.' })
  message: string;
}
