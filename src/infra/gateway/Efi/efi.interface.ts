export interface EfiTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface EfiPixResponse {
  pixCopiaECola: string;
  txid: string;
  revisao: number;
  calendario: {
    criacao: Date;
    expiracao: number;
  };
  status: string;
  chave: string;
  valor: {
    original: string;
  };
}

export interface EfiSendPixResponse {
  status: string;
  e2eId?: string;
  idEnvio: string;
}

export interface EfiSentPixStatusResponse {
  status: string;
  endToEndId?: string;
  idEnvio: string;
}
