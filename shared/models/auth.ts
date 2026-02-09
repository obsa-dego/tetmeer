import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User role enum
export const userRoleEnum = ["user", "admin", "super_admin"] as const;
export type UserRole = typeof userRoleEnum[number];

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  nickname: varchar("nickname"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete support
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Admin audit log action types
export const auditActionEnum = [
  "user_update", "user_delete", "user_restore",
  "role_change", "ban_user", "unban_user",
  "premium_grant", "premium_revoke",
  "item_grant", "item_revoke",
  "announcement_create", "announcement_update", "announcement_delete",
  "settings_change", "system_config"
] as const;
export type AuditAction = typeof auditActionEnum[number];

// Admin audit logs table - tracks all admin actions
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull(), // The admin who performed the action
  action: varchar("action").notNull(), // Action type from auditActionEnum
  targetType: varchar("target_type").notNull(), // 'user', 'announcement', 'settings', etc.
  targetId: varchar("target_id"), // ID of the affected entity
  previousValue: jsonb("previous_value"), // State before the change
  newValue: jsonb("new_value"), // State after the change
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("admin_audit_logs_admin_id_idx").on(table.adminId),
  index("admin_audit_logs_action_idx").on(table.action),
  index("admin_audit_logs_created_at_idx").on(table.createdAt),
]);

export type InsertAuditLog = typeof adminAuditLogs.$inferInsert;
export type AuditLog = typeof adminAuditLogs.$inferSelect;
