export interface CreateGatewayResponseParams {
  interactionType:
    | 'GENERATE_DONATION_QRCODE'
    | 'RESPONSE_WEBHOOK_PIX'
    | 'REQUEST_WITHDRAWAL'
    | 'RESPONSE_WEBHOOK_WITHDRAWAL';
  provider: 'efi';
  payload: unknown;
  externalId?: string;
  statusCode?: number;
}
