export const MAX_TOTP_ATTEMPTS = 5;

/** Hash bcrypt de valor aleatório inexistente — usado para equalizar o tempo de
 * resposta do login quando o usuário não existe (evita timing oracle). */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$/3YglkV/xxEUBetYtftZqul3RTWcFlTkRiX0FZEb8nzMnZXcGDwgO';
