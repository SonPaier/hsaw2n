// Sentry helper for Edge Functions
// Uses Sentry HTTP API directly (no SDK needed for Deno)

interface SentryEvent {
  event_id?: string;
  timestamp?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename?: string;
          function?: string;
          lineno?: number;
          colno?: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  environment?: string;
  server_name?: string;
  transaction?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

function generateEventId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function parseDsn(dsn: string): { publicKey: string; projectId: string; host: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    const host = url.host;
    return { publicKey, projectId, host };
  } catch {
    return null;
  }
}

export async function captureException(
  error: Error,
  options?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    transaction?: string;
    request?: Request;
  }
): Promise<string | null> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) {
    console.warn('[Sentry] No SENTRY_DSN configured, skipping error capture');
    return null;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error('[Sentry] Invalid DSN format');
    return null;
  }

  const eventId = generateEventId();
  const timestamp = new Date().toISOString();

  const event: SentryEvent = {
    event_id: eventId,
    timestamp,
    level: 'error',
    exception: {
      values: [
        {
          type: error.name || 'Error',
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: parseStackTrace(error.stack),
              }
            : undefined,
        },
      ],
    },
    tags: {
      runtime: 'deno',
      platform: 'edge-function',
      ...options?.tags,
    },
    extra: options?.extra,
    user: options?.user,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    server_name: 'supabase-edge-function',
    transaction: options?.transaction,
  };

  if (options?.request) {
    const url = new URL(options.request.url);
    event.request = {
      url: `${url.origin}${url.pathname}`,
      method: options.request.method,
      headers: Object.fromEntries(
        [...options.request.headers.entries()].filter(
          ([key]) => !['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase())
        )
      ),
    };
    event.tags = {
      ...event.tags,
      'request.path': url.pathname,
    };
  }

  try {
    const sentryUrl = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=edge-function/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Sentry] Failed to send event: ${response.status}`);
      return null;
    }

    console.log(`[Sentry] Captured exception: ${eventId}`);
    return eventId;
  } catch (e) {
    console.error('[Sentry] Error sending to Sentry:', e);
    return null;
  }
}

export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  options?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<string | null> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) {
    return null;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    return null;
  }

  const eventId = generateEventId();

  const event: SentryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    level,
    message,
    tags: {
      runtime: 'deno',
      platform: 'edge-function',
      ...options?.tags,
    },
    extra: options?.extra,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    server_name: 'supabase-edge-function',
  };

  try {
    const sentryUrl = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=edge-function/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(event),
    });
    return eventId;
  } catch {
    return null;
  }
}

function parseStackTrace(stack: string): Array<{ filename?: string; function?: string; lineno?: number; colno?: number }> {
  const lines = stack.split('\n').slice(1);
  return lines
    .map((line) => {
      const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (match) {
        return {
          function: match[1] || '<anonymous>',
          filename: match[2],
          lineno: parseInt(match[3], 10),
          colno: parseInt(match[4], 10),
        };
      }
      return null;
    })
    .filter((frame): frame is NonNullable<typeof frame> => frame !== null)
    .reverse();
}

// Wrapper for edge function handlers with automatic error capturing
export function withSentry<T>(
  functionName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      await captureException(err, {
        transaction: functionName,
        request: req,
        tags: {
          function_name: functionName,
        },
      });

      // Re-throw to let the normal error handling continue
      throw error;
    }
  };
}
