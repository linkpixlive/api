import { PaginationMetaDto } from './pagination.dto';

export class PaginatedResponseDto<T> {
  items: T[];
  meta: PaginationMetaDto;

  constructor(items: T[], meta: PaginationMetaDto) {
    this.items = items;
    this.meta = meta;
    this.meta.totalPages = Math.ceil(meta.total / meta.limit);
  }
}
