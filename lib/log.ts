// Structured server logs: one JSON line per event, so Vercel's log search can filter on
// any field. Never pass secrets, file contents or answers in `fields`.

type Fields = Record<string, unknown>;

const line = (event: string, fields: Fields) => JSON.stringify({ event, ...fields });

export const log = {
  info: (event: string, fields: Fields = {}) => console.info(line(event, fields)),
  warn: (event: string, fields: Fields = {}) => console.warn(line(event, fields)),
  error: (event: string, fields: Fields = {}) => console.error(line(event, fields)),
};

/** An error as a log field: the message only, never a stack with request data in it. */
export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
