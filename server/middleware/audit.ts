import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { adminAuditLogs, type AuditAction } from "@shared/schema";

interface AuditLogParams {
  action: AuditAction;
  targetType: string;
  targetId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export async function createAuditLog(
  req: Request,
  params: AuditLogParams
): Promise<void> {
  try {
    const adminUser = (req as any).adminUser;
    if (!adminUser) {
      console.error("Audit log failed: No admin user found in request");
      return;
    }

    await db.insert(adminAuditLogs).values({
      adminId: adminUser.id,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId || null,
      previousValue: params.previousValue || null,
      newValue: params.newValue || null,
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export function withAuditLog(
  action: AuditAction,
  targetType: string,
  extractTargetId?: (req: Request) => string | undefined,
  extractValues?: (req: Request, res: Response) => { previous?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  return async function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const values = extractValues ? extractValues(req, res) : {};
        createAuditLog(req, {
          action,
          targetType,
          targetId: extractTargetId ? extractTargetId(req) : undefined,
          previousValue: values.previous,
          newValue: values.new,
        }).catch(console.error);
      }
      return originalJson(body);
    };
    
    next();
  };
}
