export function maskPixKey(keyType: string, key: string): string {
  switch (keyType) {
    case 'cpf': {
      const clean = key.replace(/\D/g, '');
      if (clean.length === 11) {
        return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
      }
      return key;
    }

    case 'cnpj': {
      const clean = key.replace(/\D/g, '');
      if (clean.length === 14) {
        return `**.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-**`;
      }
      return key;
    }

    case 'phone': {
      const clean = key.replace(/\D/g, '');
      // Handle "+5511999999999" (13 digits) or "11999999999" (11 digits)
      if (clean.length >= 11) {
        const hasDDI = clean.length > 11;
        const number = hasDDI ? clean.substring(clean.length - 11) : clean;
        const ddi = hasDDI
          ? `+${clean.substring(0, clean.length - 11)} `
          : '+55 ';

        return `${ddi}(${number.substring(0, 2)}) 9****-${number.substring(7)}`;
      }
      return key;
    }

    case 'email': {
      const [username, domain] = key.split('@');
      if (!domain) return key;
      const visibleStart = username.substring(0, Math.min(2, username.length));
      return `${visibleStart}***@${domain}`;
    }

    case 'random': {
      if (key.length > 8) {
        return `${key.substring(0, 4)}***${key.substring(key.length - 4)}`;
      }
      return '***';
    }
    default:
      return key;
  }
}
