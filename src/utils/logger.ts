export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug('[Boardmarks]', ...args);
  },
  warn: (...args: unknown[]) => console.warn('[Boardmarks]', ...args),
  error: (...args: unknown[]) => console.error('[Boardmarks]', ...args),
};
