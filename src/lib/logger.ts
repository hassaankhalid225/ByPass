import pino from 'pino'
import { env, isProduction } from './env'

/**
 * Structured JSON logging. Every line that belongs to a request carries its
 * requestId (bind it with `logger.child({ requestId })`). URLs are redacted to
 * scheme://host/… at info and below; full URLs appear only at debug, which is off
 * in production. See docs/07-security.md §8.
 */

export type Logger = pino.Logger

const base: Logger = pino({
  level: env.LOG_LEVEL,
  // pino-pretty in dev only; raw JSON in prod for log aggregators.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['url', 'source', 'destination', 'req.headers.authorization', 'req.headers.cookie'],
    censor: '[redacted]',
  },
})

export const logger = base

/** A logger bound to a request id, for use across a single request's lifetime. */
export function requestLogger(requestId: string): Logger {
  return base.child({ requestId })
}

/** Reduce a URL to a safe form for logging at info level. */
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host}/…`
  } catch {
    return '[unparseable-url]'
  }
}
