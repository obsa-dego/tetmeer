import { Response } from "express";
import { randomUUID } from "crypto";
import { supabase } from "../supabase";

const PUBLIC_BUCKET = "public-assets";
const PRIVATE_BUCKET = "private-uploads";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Gets a signed upload URL for file upload
  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
    const objectId = randomUUID();
    const filePath = `uploads/${objectId}`;

    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    }

    return {
      uploadURL: data.signedUrl,
      objectPath: `/objects/${filePath}`,
    };
  }

  // Downloads an object and pipes it to the Express response
  async downloadObject(bucket: string, objectPath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(objectPath);

      if (error || !data) {
        throw new ObjectNotFoundError();
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.set({
        "Content-Type": data.type || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      res.send(buffer);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) throw error;
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets a signed URL for reading a private object
  async signObjectURL(bucket: string, objectPath: string, ttlSec: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, ttlSec);

    if (error || !data) {
      throw new Error(`Failed to sign URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // Gets a public URL for a public bucket object
  getPublicURL(objectPath: string): string {
    const { data } = supabase.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  }

  // Normalizes a raw storage URL or path to internal /objects/ format
  normalizeObjectEntityPath(rawPath: string): string {
    // If it's already a normalized path, return as-is
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    // Handle Supabase storage URLs
    if (rawPath.includes("supabase.co/storage/")) {
      try {
        const url = new URL(rawPath);
        const pathParts = url.pathname.split("/storage/v1/object/");
        if (pathParts.length > 1) {
          // Extract bucket/path from Supabase URL
          const storagePath = pathParts[1];
          // Remove 'public/' or 'sign/' prefix and bucket name
          const parts = storagePath.split("/");
          // Skip 'public' or 'sign' and bucket name
          const objectParts = parts.slice(2);
          return `/objects/${objectParts.join("/")}`;
        }
      } catch {
        // Not a valid URL, return as-is
      }
    }

    // Handle signed URLs by extracting path
    if (rawPath.startsWith("http")) {
      try {
        const url = new URL(rawPath);
        // Extract the meaningful part from the path
        const match = url.pathname.match(/\/uploads\/(.+)/);
        if (match) {
          return `/objects/uploads/${match[1]}`;
        }
      } catch {
        // Not a valid URL
      }
    }

    return rawPath;
  }

  // Gets the object file path from an /objects/ path
  getObjectFilePath(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    return objectPath.slice("/objects/".length);
  }

  // Tries to set visibility and return normalized path
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: { owner: string; visibility: "public" | "private" }
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);

    if (aclPolicy.visibility === "public" && normalizedPath.startsWith("/objects/")) {
      const filePath = this.getObjectFilePath(normalizedPath);
      // Move from private to public bucket if needed
      try {
        const { data: fileData } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .download(filePath);

        if (fileData) {
          await supabase.storage
            .from(PUBLIC_BUCKET)
            .upload(filePath, fileData, { upsert: true });
        }
      } catch {
        // File might already be in public bucket or not exist in private
      }
    }

    return normalizedPath;
  }

  // Checks if a user can access an object
  async canAccessObjectEntity({
    userId,
    objectPath,
  }: {
    userId?: string;
    objectPath: string;
  }): Promise<boolean> {
    // Public bucket objects are always accessible
    const filePath = this.getObjectFilePath(objectPath);

    // Try public bucket first
    const { data: publicData } = await supabase.storage
      .from(PUBLIC_BUCKET)
      .download(filePath);

    if (publicData) return true;

    // For private bucket, require authentication
    if (!userId) return false;

    // Check if file exists in private bucket
    const { data: privateData } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .download(filePath);

    return !!privateData;
  }
}
