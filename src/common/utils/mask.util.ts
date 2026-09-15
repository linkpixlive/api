export function maskPixKey(keyType: string, key: string): string {
  switch (keyType) {
    case 'cpf': {
      const clean = key.replace(/\D/g, '');
      if (clean.length === 11) {
        return `***.***.***-${clean.substring(9)}`;
      }
      return key;
    }

    case 'cnpj': {
      const clean = key.replace(/\D/g, '');
      if (clean.length === 14) {
        return `**.***.***/****-${clean.substring(12)}`;
      }
      return key;
    }

    case 'phone': {
      const clean = key.replace(/\D/g, '');
      // Usa os últimos 11 dígitos (DDD + número), sem DDI (+55):
      // "+5511999999999" ou "11999999999" -> "(11) 9****-9999"
      if (clean.length >= 11) {
        const number = clean.substring(clean.length - 11);

        return `(${number.substring(0, 2)}) 9****-${number.substring(7)}`;
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
