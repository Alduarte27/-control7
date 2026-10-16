export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// In-memory store for rate limiting
const rateLimitCache = new Map<string, { count: number; expiresAt: number }>();

/**
 * Basic in-memory rate limiter using a JS Map.
 * Note: In a distributed environment (Vercel Edge, multiple Lambdas), this is isolated per instance.
 * For a fully robust solution, use Redis (e.g. Upstash).
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  
  // Clean up expired entries (simple garbage collection on every request)
  if (rateLimitCache.size > 1000) {
      for (const [key, value] of rateLimitCache.entries()) {
          if (value.expiresAt < now) {
              rateLimitCache.delete(key);
          }
      }
  }

  const record = rateLimitCache.get(identifier);

  if (!record || record.expiresAt < now) {
    // New or expired record
    rateLimitCache.set(identifier, {
      count: 1,
      expiresAt: now + windowMs,
    });
    
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  // Active record
  record.count += 1;

  return {
    success: record.count <= limit,
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: record.expiresAt,
  };
}
