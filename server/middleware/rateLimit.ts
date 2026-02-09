import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(rateLimitStore.keys());
  for (const key of keys) {
    const entry = rateLimitStore.get(key);
    if (entry && entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000, // 1 minute default
    maxRequests = 100, // 100 requests per window
    keyGenerator = (req) => {
      const userId = (req as any).adminUser?.id || (req.user as any)?.claims?.sub || req.ip;
      return `${req.path}:${userId}`;
    },
    message = "Too many requests, please try again later",
  } = options;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count).toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());

    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }

    next();
  };
}

export const adminRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 60, // 60 requests per minute for admin APIs
  message: "Admin API rate limit exceeded",
});

export const strictRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 requests per minute for sensitive operations
  message: "Rate limit exceeded for sensitive operation",
});
