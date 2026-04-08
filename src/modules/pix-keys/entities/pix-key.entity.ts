export class PixKeyEntity {
  id: string;
  key: string;
  keyType: string;
  alias?: string;
  createdAt: Date;

  constructor(partial: Partial<PixKeyEntity>) {
    Object.assign(this, partial);
  }
}
