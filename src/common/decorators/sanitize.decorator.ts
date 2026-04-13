import { Transform } from 'class-transformer';
import * as xss from 'xss';

export function SanitizeHTML() {
  return Transform(({ value }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof value === 'string' ? xss.filterXSS(value) : value;
  });
}
