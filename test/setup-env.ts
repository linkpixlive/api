/**
 * Env dummies para testes unitários (roda antes de qualquer spec via `setupFiles`).
 * Valores estáticos e determinísticos — specs não dependem de .env e o job
 * `quality` do CI não precisa de serviços. Só defina aqui o que é lido
 * diretamente de `process.env` (utils) ou na instanciação de classes;
 * dependências de `ConfigService` devem ser mockadas no spec.
 */
process.env.ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.EFI_WEBHOOK_SECRET = 'dummy-webhook-secret';
process.env.JWT_SECRET = 'dummy-jwt-secret-32-chars-minimum-ok!';
process.env.BUCKET_URL = 'https://dummy-bucket.example.com';
process.env.REDIS_URL = 'redis://localhost:6380';
