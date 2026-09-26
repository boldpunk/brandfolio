import path from 'node:path';

export type ServerConfig = {
  port: number;
  host: string;
  dataDir: string;
  adminEmails: Set<string>;
  production: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 3517);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid PORT: ${env.PORT}`);
  return {
    port,
    host: env.HOST || '127.0.0.1',
    dataDir: path.resolve(env.DATA_DIR || './.data'),
    adminEmails: new Set(
      (env.ADMIN_EMAILS ?? '')
        .split(',')
        .map(normalizeEmail)
        .filter(Boolean),
    ),
    production: env.NODE_ENV === 'production',
  };
}
