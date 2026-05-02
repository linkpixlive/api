import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import { Resend } from 'resend';
import { Email } from './email.type';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  constructor(
    @Inject('RESEND_CLIENT') private resend: Resend,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    try {
      const { data } = job as Job<Email>;
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
        from: this.configService.getOrThrow<string>('EMAIL_FROM_ADDRESS'),
        subject,
        html,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
