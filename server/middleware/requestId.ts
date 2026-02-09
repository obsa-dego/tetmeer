import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const id = (req.headers["x-request-id"] as string) || randomUUID();
    (req as any).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  };
}
