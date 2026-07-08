import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

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

    req.session.userId = user.id;
    req.session.githubToken = tokenData.access_token;
    res.redirect(`${frontendUrl}/`);
  } catch (err) {
    logger.error({ err }, "GitHub OAuth callback error");
    res.redirect(`${frontendUrl}/?error=server_error`);
  }
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
  const token = req.session.githubToken;

  // Revoke the GitHub OAuth token so GitHub re-prompts on next login
  if (token && GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    try {
      await fetch(`https://api.github.com/applications/${GITHUB_CLIENT_ID}/token`, {
        method: "DELETE",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${GITHUB_CLIENT_ID}:${GITHUB_CLIENT_SECRET}`).toString("base64")}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "AI-Powered-Developer-Assistant",
        },
        body: JSON.stringify({ access_token: token }),
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
  res.clearCookie("connect.sid");
  res.json({ success: true });
});

export default router;
