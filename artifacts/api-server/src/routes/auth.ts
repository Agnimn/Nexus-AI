import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import crypto from "crypto";
import { signJwt } from "../lib/jwt";

declare module "express-session" {
  interface SessionData {
    userId: number;
    githubToken: string;
  }
}

const router = Router();

const GITHUB_CLIENT_ID = process.env["GITHUB_CLIENT_ID"];
const GITHUB_CLIENT_SECRET = process.env["GITHUB_CLIENT_SECRET"];

const BACKEND_URL = process.env.BACKEND_URL!;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// ---------------------------------------------------------------------------
// One-time token store for cross-domain OAuth handoff
// Each entry: { userId, githubToken, expiresAt }
// ---------------------------------------------------------------------------

interface PendingToken {
  userId: number;
  githubToken: string;
  expiresAt: number;
}

const pendingTokens = new Map<string, PendingToken>();

// Purge expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingTokens.entries()) {
    if (val.expiresAt < now) pendingTokens.delete(key);
  }
}, 5 * 60 * 1000);

function createOAuthToken(userId: number, githubToken: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  pendingTokens.set(token, {
    userId,
    githubToken,
    expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes
  });
  return token;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/auth/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    res.status(500).json({ error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." });
    return;
  }
  const callbackUrl = `${BACKEND_URL}/api/auth/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=repo,user:email&force_verify=true`;
  req.log.info({ authUrl, GITHUB_CLIENT_ID, callbackUrl }, "Redirecting to GitHub OAuth");
  res.redirect(authUrl);
});

router.get("/auth/github/callback", async (req, res) => {
  const { code } = req.query as { code?: string };
  const frontendUrl = FRONTEND_URL;

  if (!code || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.redirect(`${frontendUrl}/?error=oauth_failed`);
    return;
  }

  try {
    const callbackUrl = `${BACKEND_URL}/api/auth/github/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      req.log.error({ tokenData }, "Failed to get access token");
      res.redirect(`${frontendUrl}/?error=oauth_failed`);
      return;
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Powered-Developer-Assistant",
      },
    });

    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url: string;
    };

    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.githubId, String(githubUser.id)));
    let user = existingUsers[0];

    if (!user) {
      const inserted = await db.insert(usersTable).values({
        githubId: String(githubUser.id),
        login: githubUser.login,
        name: githubUser.name ?? null,
        email: githubUser.email ?? null,
        avatarUrl: githubUser.avatar_url,
        accessToken: tokenData.access_token,
      }).returning();
      user = inserted[0]!;
    } else {
      await db.update(usersTable)
        .set({
          login: githubUser.login,
          name: githubUser.name ?? null,
          email: githubUser.email ?? null,
          avatarUrl: githubUser.avatar_url,
          accessToken: tokenData.access_token,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));
    }

    // -----------------------------------------------------------------------
    // Cross-domain cookie workaround:
    // Instead of setting the cookie in the redirect response (which browsers
    // block for cross-site redirects), we generate a short-lived one-time
    // token and hand it to the frontend via the URL.  The frontend then POSTs
    // it to /api/auth/exchange which sets the proper session cookie via a
    // normal same-origin (or credentialed) XHR — which browsers always allow.
    // -----------------------------------------------------------------------
    const oauthToken = createOAuthToken(user.id, tokenData.access_token);
    req.log.info({ userId: user.id }, "OAuth complete — redirecting with handoff token");
    res.redirect(`${frontendUrl}/?token=${oauthToken}`);
  } catch (err) {
    logger.error({ err }, "GitHub OAuth callback error");
    res.redirect(`${frontendUrl}/?error=server_error`);
  }
});

// ---------------------------------------------------------------------------
// Token exchange endpoint — frontend POSTs the short-lived token here to
// obtain a real session cookie.  This is a credentialed XHR, so the browser
// happily accepts the Set-Cookie header.
// ---------------------------------------------------------------------------
router.post("/auth/exchange", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const pending = pendingTokens.get(token);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingTokens.delete(token);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Consume the token (one-time use)
  pendingTokens.delete(token);

  const users = await db.select().from(usersTable).where(eq(usersTable.id, pending.userId));
  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.session.userId = pending.userId;
  req.session.githubToken = pending.githubToken;

  // Sign a JWT so the frontend can authenticate via Authorization: Bearer
  // header instead of relying on cross-domain cookies (which Chrome/Safari
  // block as third-party cookies in deployed cross-origin setups).
  const jwtSecret = process.env["SESSION_SECRET"]!;
  const jwt = signJwt(
    { userId: pending.userId, githubToken: pending.githubToken },
    jwtSecret,
  );

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, "Session save failed during exchange");
      // Even if session save fails, we can still return the JWT
      // so the client can authenticate via Bearer token.
    }

    res.json({
      token: jwt,
      id: user.id,
      githubId: user.githubId,
      login: user.login,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const user = users[0];

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
    id: user.id,
    githubId: user.githubId,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", async (req, res) => {
  const githubToken = req.session.githubToken;

  // Revoke the GitHub OAuth token so GitHub re-prompts on next login
  if (githubToken && GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    try {
      await fetch(`https://api.github.com/applications/${GITHUB_CLIENT_ID}/token`, {
        method: "DELETE",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${GITHUB_CLIENT_ID}:${GITHUB_CLIENT_SECRET}`).toString("base64")}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "AI-Powered-Developer-Assistant",
        },
        body: JSON.stringify({ access_token: githubToken }),
      });
    } catch (err) {
      logger.warn({ err }, "Failed to revoke GitHub token");
    }
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destruction error");
    }
  });

  // Clear cookie with same options used at creation.
  // The JWT stored client-side must be cleared by the frontend (localStorage.removeItem).
  res.clearCookie("connect.sid", {
    secure: true,
    sameSite: "none",
    httpOnly: true,
  });
  res.json({ success: true });
});

export default router;
