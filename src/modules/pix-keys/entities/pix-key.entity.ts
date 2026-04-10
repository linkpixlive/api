export class PixKeyEntity {
  id: string;
  key?: string;
  keyMasked: string;
  keyType: string;
  alias?: string;
  createdAt: Date;

  constructor(partial: Partial<PixKeyEntity>) {
    Object.assign(this, partial);
  }
}
