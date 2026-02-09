// Simplified ACL for Supabase Storage
// Supabase Storage uses RLS policies and public/private buckets instead of GCS metadata ACL

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

// These functions are no-ops/simplified since Supabase Storage uses RLS policies
export async function setObjectAclPolicy(
  _objectPath: string,
  _aclPolicy: ObjectAclPolicy,
): Promise<void> {
  // ACL is managed by Supabase Storage RLS policies
  // No-op: public/private is handled by bucket selection
}

export async function getObjectAclPolicy(
  _objectPath: string,
): Promise<ObjectAclPolicy | null> {
  // ACL is managed by Supabase Storage RLS policies
  return null;
}

export async function canAccessObject({
  userId,
  objectPath,
  requestedPermission,
}: {
  userId?: string;
  objectPath: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  // For read: public bucket objects are always accessible
  // For write: requires authentication
  if (requestedPermission === ObjectPermission.READ) {
    return true; // Public bucket objects are always readable
  }

  return !!userId; // Write requires authentication
}
