import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    (req as any).adminUser = user;
    next();
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function isSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Super Admin access required" });
    }

    (req as any).adminUser = user;
    next();
  } catch (error) {
    console.error("Super admin check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
