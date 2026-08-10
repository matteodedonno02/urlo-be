export interface AppConfig {
  host: string;
  port: number;
  cors?: {
    whitelist: string[];
  };
  database?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    name?: string;
    synchronize?: boolean;
    alwaysRebuild?: boolean;
  };
  migrationDatabase?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    name?: string;
  };
}
