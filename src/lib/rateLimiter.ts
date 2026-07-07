import { redisCache } from './redis';

// Minimal request/response shapes for the optional Express-style middleware below.
interface RateLimitRequest {
  user?: { id?: string };
  path?: string;
  ip?: string;
  headers?: { get(name: string): string | null };
}
interface RateLimitResponse {
  set(header: string, value: string): void;
  status(code: number): { json(body: unknown): unknown };
}

export interface RateLimitConfig {
  window: number; // in seconds
  limit: number;
  keyGenerator?: (req: RateLimitRequest) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

class RateLimiter {
  private defaultConfig: RateLimitConfig = {
    window: 60, // 1 minute default
    limit: 100, // 100 requests per minute default
    keyGenerator: req => {
      // Default IP-based rate limiting
      return req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip') || 'unknown';
    },
  };

  async checkLimit(
    identifier: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      const result = await redisCache.incrementRateLimit(
        identifier,
        finalConfig.limit,
        finalConfig.window
      );

      return {
        allowed: result.current <= finalConfig.limit,
        remaining: result.remaining,
        reset: result.reset,
        limit: finalConfig.limit,
        retryAfter:
          result.remaining === 0 ? Math.ceil((result.reset - Date.now()) / 1000) : undefined,
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow the request but log the error
      return {
        allowed: true,
        remaining: finalConfig.limit,
        reset: Date.now() + finalConfig.window * 1000,
        limit: finalConfig.limit,
      };
    }
  }

  async checkApiLimit(endpoint: string, userId?: string): Promise<RateLimitResult> {
    const identifier = userId ? `user:${userId}:${endpoint}` : `ip:${endpoint}`;
    const config = {
      window: 300, // 5 minutes
      limit: endpoint === 'upload' ? 5 : 50, // Stricter limits for upload
    };

    return this.checkLimit(identifier, config);
  }

  async checkAuthLimit(ip: string): Promise<RateLimitResult> {
    return this.checkLimit(`auth:${ip}`, {
      window: 300, // 5 minutes
      limit: 10, // 10 login attempts per 5 minutes
    });
  }

  async checkUploadLimit(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(`upload:${userId}`, {
      window: 3600, // 1 hour
      limit: 10, // 10 uploads per hour
    });
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Express/Next.js middleware for API routes
export function withRateLimit(
  config: Partial<RateLimitConfig> = {},
  customKeyGenerator?: (req: RateLimitRequest) => string
) {
  return async (req: RateLimitRequest, res: RateLimitResponse, next: () => void) => {
    try {
      const identifier = customKeyGenerator
        ? customKeyGenerator(req)
        : req.user?.id
          ? `user:${req.user.id}:${req.path}`
          : `ip:${req.ip}:${req.path}`;

      const result = await rateLimiter.checkLimit(identifier, config);

      // Add rate limit headers
      res.set('X-RateLimit-Limit', result.limit.toString());
      res.set('X-RateLimit-Remaining', result.remaining.toString());
      res.set('X-RateLimit-Reset', result.reset.toString());

      if (result.retryAfter) {
        res.set('Retry-After', result.retryAfter.toString());
      }

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Fail open - allow the request
      next();
    }
  };
}

// Specific route handlers
export const rateLimiters = {
  // Auth endpoints
  auth: withRateLimit({ window: 300, limit: 10 }),

  // General API endpoints
  api: withRateLimit({ window: 300, limit: 50 }),

  // Upload endpoints (more restrictive)
  upload: withRateLimit({ window: 3600, limit: 5 }),

  // Search endpoints
  search: withRateLimit({ window: 60, limit: 30 }),

  // Comment endpoints
  comment: withRateLimit({ window: 60, limit: 20 }),

  // Like endpoints
  like: withRateLimit({ window: 60, limit: 100 }),
};

// Utility for client-side rate limiting
export class ClientRateLimiter {
  private store = new Map<string, { count: number; reset: number }>();

  async check(identifier: string, limit: number, window: number): Promise<boolean> {
    const now = Date.now();
    const resetTime = now + window * 1000;

    const existing = this.store.get(identifier);

    if (existing && existing.reset > now) {
      if (existing.count >= limit) {
        return false;
      }
      existing.count++;
      return true;
    } else {
      this.store.set(identifier, { count: 1, reset: resetTime });
      return true;
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const clientRateLimiter = new ClientRateLimiter();
