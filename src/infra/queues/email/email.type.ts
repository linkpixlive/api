export interface Email {
  to: string;
  subject: string;
  templateName: 'verify-email' | 'forgot-password';
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
