import type { RequestHandler } from "express";

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in; " +
        "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.polar.sh wss://*; " +
        "font-src 'self' data:; " +
        "media-src 'self' blob:; " +
        "frame-src 'none';"
    );
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );

    next();
  };
}
