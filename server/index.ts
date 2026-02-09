import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupMatchmaking } from './matchmaking';
import { setupCasualMatchmaking } from './casual-matchmaking';
import { setupChatWebSocket } from './chat-websocket';
import { startScheduledActionsProcessor } from './scheduled-actions-processor';
import { securityHeaders } from './middleware/security';
import { requestId } from './middleware/requestId';
import { AppError } from './errors';

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(requestId());
app.use(securityHeaders());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  
  // Setup WebSocket matchmaking server (ranked)
  setupMatchmaking(httpServer);
  log("Matchmaking WebSocket server initialized", "matchmaking");

  // Setup WebSocket casual matchmaking server
  setupCasualMatchmaking(httpServer);
  log("Casual matchmaking WebSocket server initialized", "casual");

  // Setup WebSocket chat server
  setupChatWebSocket(httpServer);
  log("Chat WebSocket server initialized", "chat");

  // Start scheduled shop actions processor
  startScheduledActionsProcessor();
  log("Scheduled actions processor started", "scheduler");

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof AppError ? err.statusCode : (err.status || err.statusCode || 500);
    const message = err.message || "Internal Server Error";
    const code = err instanceof AppError ? err.code : undefined;
    const reqId = (req as any).requestId;

    console.error(`[error] ${reqId || '-'} ${status}: ${message}`, err.stack || "");
    res.status(status).json({ message, ...(code && { code }), ...(reqId && { requestId: reqId }) });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
