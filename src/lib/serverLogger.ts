type LogLevel = 'info' | 'warn' | 'error';
type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const record = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}

export const serverLogger = {
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
