// Production-safe logging utility
// Removes console.log in production, keeps errors and warnings

const isProduction = process.env.NODE_ENV === 'production'

export const logger = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args)
    }
  },
  info: (...args: any[]) => {
    if (!isProduction) {
      console.info(...args)
    }
  },
  warn: (...args: any[]) => {
    // Keep warnings in production for important issues
    console.warn(...args)
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args)
  },
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args)
    }
  },
}

// For structured logging in production (can be sent to logging service)
export const logError = (error: Error | unknown, context?: Record<string, any>) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  if (isProduction) {
    // In production, you might want to send to a logging service
    // Example: Sentry, LogRocket, etc.
    console.error('[ERROR]', {
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString(),
    })
  } else {
    console.error('[ERROR]', errorMessage, errorStack, context)
  }
}

