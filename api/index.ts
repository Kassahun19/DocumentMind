import type { IncomingMessage, ServerResponse } from "http";
import app from "../server";

// Vercel Node serverless entrypoint.
// It delegates requests to the existing Express app.
// This ensures Vercel can actually execute your `/api/auth/login` and
// `/api/auth/register` routes (and all other Express routes).
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
