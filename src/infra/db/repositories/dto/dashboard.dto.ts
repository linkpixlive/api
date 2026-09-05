// Parâmetros já normalizados e validados pelo GetHistoryQueryDto.
// O repositório não deve validar input — apenas persistir/consultar.
export interface GetDonationHistoryParams {
  userId: string;
  page: number;
  limit: number;
  status?: 'paid' | 'displayed';
  days?: 7 | 15 | 30;
  search?: string;
  searchBy?: 'name' | 'message';
}
