import { PLANS, type Plan } from '@/cloud/contract';
import { normalizeEmail, type ServerConfig } from './config';
import { Store } from './store';

const USAGE = 'Usage: node server.mjs grant <email> <pro|free> [days]';

/** `grant <email> <pro|free> [days]`: sets a plan straight in the database. Returns the exit code. */
export function runCli(args: string[], config: ServerConfig): number {
  const [command, rawEmail, rawPlan, rawDays] = args;
  if (command !== 'grant' || !rawEmail || !rawPlan) {
    console.error(USAGE);
    return 2;
  }
  if (!(PLANS as readonly string[]).includes(rawPlan)) {
    console.error(`Unknown plan "${rawPlan}". ${USAGE}`);
    return 2;
  }
  const days = rawDays === undefined ? null : Number(rawDays);
  if (days !== null && (!Number.isInteger(days) || days <= 0)) {
    console.error(`Days must be a positive whole number. ${USAGE}`);
    return 2;
  }
  const email = normalizeEmail(rawEmail);
  const store = new Store(config.dataDir);
  try {
    if (!store.grantPlan(email, rawPlan as Plan, days)) {
      console.error(`No user with email ${email}`);
      return 1;
    }
    const user = store.userByEmail(email);
    console.log(`${email}: ${rawPlan}${user?.plan_until ? ` until ${user.plan_until}` : ''}`);
    return 0;
  } finally {
    store.close();
  }
}
