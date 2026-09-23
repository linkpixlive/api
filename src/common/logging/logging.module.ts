import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const file = new DailyRotateFile({
          dirname: config.get<string>('LOG_DIR') || 'logs',
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '7d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        });

        file.on('error', (err) => console.error('[logs]', err));

        return {
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf((info) => {
                  const ctx =
                    typeof info.context === 'string' ? info.context : 'App';
                  const msg =
                    typeof info.message === 'string'
                      ? info.message
                      : JSON.stringify(info.message);
                  return `${String(info.timestamp)} [${ctx}] ${String(info.level)}: ${msg}`;
                }),
              ),
            }),
            file,
          ],
        };
      },
    }),
  ],
})
export class LoggingModule {}
