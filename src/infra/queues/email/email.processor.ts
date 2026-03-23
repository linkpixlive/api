import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import Handlebars from 'handlebars';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import { Resend } from 'resend';

interface EmailJob {
  to: string;
  subject: string;
  templateName: 'test';
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  constructor(@Inject('RESEND_CLIENT') private resend: Resend) {
    super();
  }

  async process(job: Job): Promise<any> {
    try {
      const { data } = job as Job<EmailJob>;
      const { to, subject, templateName, context } = data;

      const filePath = path.join(
        process.cwd(),
        'src/templates/emails',
        `${templateName}.hbs`,
      );
      const source = await fs.readFile(filePath, 'utf8');

      const template = Handlebars.compile(source);
      const html = template(context);

      await this.resend.emails.send({
        to,
        from: 'no-reply@hxmoura.com.br',
        subject,
        html,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
