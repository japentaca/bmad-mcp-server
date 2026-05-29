import { ActivityLogger, getActivityLogger as getSharedLogger } from '@bmad/shared';

let localInstance: ActivityLogger | null = null;

export function getActivityLogger(): ActivityLogger {
  if (!localInstance) {
    localInstance = getSharedLogger();
  }
  return localInstance;
}

export { ActivityLogger };
