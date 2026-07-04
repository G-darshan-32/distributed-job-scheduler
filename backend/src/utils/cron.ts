import * as nodeCron from 'node-cron';

export function isValidCron(expression: string): boolean {
  return nodeCron.validate(expression);
}

/**
 * Calculate next run time for a cron expression.
 * Returns a Date offset from now.
 */
export function getNextRunAt(cronExpression: string, from: Date = new Date()): Date {
  // Use node-cron schedule to compute next execution
  // We create a temporary schedule, fire it once, and destroy it
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  // Compute next date by brute-force scanning forward (accurate up to minute)
  const next = new Date(from.getTime() + 60000); // start at next minute
  next.setSeconds(0, 0);

  for (let i = 0; i < 527040; i++) { // max 1 year of minutes
    if (nodeCron.validate(cronExpression)) {
      // Check if current time matches
      if (matchesCron(cronExpression, next)) return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error(`Could not determine next run for cron: ${cronExpression}`);
}

function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  // Support 5-part (min hour dom month dow) and 6-part (sec min hour dom month dow)
  let minute: string, hour: string, dom: string, month: string, dow: string;
  if (parts.length === 6) {
    [, minute, hour, dom, month, dow] = parts;
  } else {
    [minute, hour, dom, month, dow] = parts;
  }

  return (
    matchField(minute, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dom, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dow, date.getDay(), 0, 6)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step, 10);
    const start = range === '*' ? min : parseInt(range, 10);
    if ((value - start) % stepNum === 0 && value >= start) return true;
    return false;
  }
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }
  return parseInt(field, 10) === value;
}
