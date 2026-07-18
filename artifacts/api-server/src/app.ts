import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifyJwt } from "./lib/jwt";

const app: Express = express();

// Trust the Render proxy so secure cookies work correctly
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

// Explicit CORS origin to allow credentials from Vercel frontend
app.use(cors({
  origin: process.env["FRONTEND_URL"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// Session middleware (kept for backward compat; JWT is the primary auth path)
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    sameSite: "none",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// ---------------------------------------------------------------------------
// JWT Bearer middleware
// When the frontend cannot rely on cross-domain cookies (third-party cookie
// restrictions in Chrome/Safari), it sends the JWT returned by /auth/exchange
// as "Authorization: Bearer <token>".  This middleware verifies it and injects
// the userId + githubToken into the session object so that all existing
// requireAuth guards and req.session.userId references work unchanged.
// ---------------------------------------------------------------------------
app.use((req, _res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ") && !req.session.userId) {
    const token = authHeader.slice(7);
    const payload = verifyJwt(token, sessionSecret);
    if (payload) {
      req.session.userId = payload.userId;
      req.session.githubToken = payload.githubToken;
    }
  }
  next();
});

app.use("/api", router);

export default app;
