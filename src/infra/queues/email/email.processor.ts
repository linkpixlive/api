import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import { Resend } from 'resend';
import { sleepOnIdle } from '../sleep-on-idle';
import { Email } from './email.type';

@Processor('email-queue')
export class EmailProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject('RESEND_CLIENT') private resend: Resend,
    private configService: ConfigService,
    @InjectQueue('email-queue') private emailQueue: Queue,
  ) {
    super();
  }

  @OnWorkerEvent('error')
  logError(err: Error) {
    this.logger.error(`email-queue worker: ${err.message}`);
  }

  onApplicationBootstrap() {
    sleepOnIdle(this.worker, () =>
      this.emailQueue.getJobCounts('wait', 'delayed'),
    );
  }

  async process(job: Job): Promise<any> {
    try {
      const { data } = job as Job<Email>;
      const { to, subject, templateName, context } = data;

      const filePath = path.join(
        __dirname,
        '../../../templates/emails',
        `${templateName}.hbs`,
      );
      const source = await fs.readFile(filePath, 'utf8');

      const template = Handlebars.compile(source);
      const html = template(context);

      const { error } = await this.resend.emails.send({
        to,
        from: this.configService.getOrThrow<string>('EMAIL_FROM_ADDRESS'),
        subject,
        html,
      });
      if (error) throw new Error(`resend: ${error.message}`);
    } catch (error) {
      this.logger.error(
        'Falha ao enviar email',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
