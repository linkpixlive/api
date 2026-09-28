import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const NOISY_CONTEXTS = new Set([
  'RouterExplorer',
  'RoutesResolver',
  'WebSocketsController',
]);

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const format = winston.format.combine(
          winston.format((info) => {
            const context =
              typeof info.context === 'string' ? info.context : '';

            if (
              isProduction &&
              info.level === 'info' &&
              NOISY_CONTEXTS.has(context)
            ) {
              return false;
            }

            return info;
          })(),
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        );

        return {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          format,
          transports: [
            new winston.transports.Console({
              stderrLevels: ['warn', 'error'],
            }),
          ],
        };
      },
    }),
  ],
})
export class LoggingModule {}
