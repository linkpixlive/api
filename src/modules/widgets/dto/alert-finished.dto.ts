import { IsString, Matches } from 'class-validator';

const ALERT_ID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export class AlertFinishedDto {
  @IsString()
  @Matches(ALERT_ID_REGEX, { message: 'ID do alerta inválido' })
  id: string;
}
