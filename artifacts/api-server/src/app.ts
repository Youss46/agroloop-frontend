import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { analyticsMiddleware } from "./middlewares/analytics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Allow cross-origin requests from Vercel frontend (and any other configured origins)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Railway internal)
      if (!origin) return callback(null, true);
      // Allow all origins in development
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      // In production, allow configured origins or same-origin
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
// Larger JSON limit needed for base64 avatar uploads (~2MB raw → ~3MB encoded)
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));

app.use("/api", analyticsMiddleware);
app.use("/api", router);

// In production, serve the compiled React frontend as static files.
// The frontend is built into artifacts/api-server/public/ by the Railway build command.
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "../public");
  app.use(express.static(publicDir));
  // SPA fallback: send index.html for any non-API route
  // Using a native RegExp to bypass path-to-regexp v8 strict parsing
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
