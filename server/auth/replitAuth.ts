import type { Express, RequestHandler } from "express";
import { supabase } from "../supabase";
import { authStorage } from "./storage";

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  // Supabase Auth callback handler - processes the auth code from OAuth redirect
  app.get("/api/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.redirect("/?error=no_code");
    }

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        console.error("Auth callback error:", error);
        return res.redirect("/?error=auth_failed");
      }

      // Upsert user in our database
      const user = data.session.user;
      await authStorage.upsertUser({
        id: user.id,
        email: user.email || undefined,
        firstName: user.user_metadata?.full_name || user.user_metadata?.given_name || undefined,
        lastName: user.user_metadata?.family_name || undefined,
        profileImageUrl: user.user_metadata?.avatar_url || undefined,
      });

      // Redirect to home - the client will pick up the session from Supabase
      res.redirect("/");
    } catch (err) {
      console.error("Auth callback exception:", err);
      res.redirect("/?error=auth_exception");
    }
  });

  // Logout endpoint
  app.post("/api/logout", async (_req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Keep GET logout for backwards compatibility
  app.get("/api/logout", async (_req, res) => {
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Maintain req.user.claims.sub structure for backward compatibility
    // This ensures all 49+ references to req.user.claims.sub continue to work
    (req as any).user = {
      claims: {
        sub: user.id,
        email: user.email,
      },
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// No-op for backward compatibility - sessions are now managed by Supabase client-side
export function getSession() {
  // Return a no-op middleware since we're now using JWT-based auth
  return ((_req: any, _res: any, next: any) => next()) as RequestHandler;
}
