import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbConfig } from '../models/db-config';
import { ensureDatabaseExists } from './ensure-database-exists';
import { MigrationsModule } from './migrations/migrations.module';

@Module({
  imports: [
    MigrationsModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const database = configService.get<DbConfig>('database');
        if (database) {
          await ensureDatabaseExists(database);
        }
        return {
          type: 'mysql',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
