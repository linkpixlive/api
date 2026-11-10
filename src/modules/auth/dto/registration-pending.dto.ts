import { ApiProperty } from '@nestjs/swagger';

export class RegistrationPendingDto {
  @ApiProperty({
    example: true,
    description:
      'E-mail confirmado sem conta associada: prosseguir para a conclusão do cadastro (dados do usuário).',
  })
  requiresRegistrationCompletion: boolean;
}
