import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getGithubToken(userId: number): Promise<string | null> {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return users[0]?.accessToken ?? null;
}

export async function githubFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "AI-Powered-Developer-Assistant",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getGithubRepos(token: string) {
  return githubFetch<GitHubRepo[]>("/user/repos?sort=updated&per_page=50&type=owner", token);
}

export async function getGithubPRs(token: string, owner: string, repo: string, state = "open") {
  return githubFetch<GitHubPR[]>(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`,
    token,
  );
}

export async function getGithubPR(token: string, owner: string, repo: string, prNumber: number) {
  return githubFetch<GitHubPR>(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
}

export async function getGithubPRFiles(token: string, owner: string, repo: string, prNumber: number) {
  return githubFetch<GitHubFile[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`, token);
}

export async function getGithubCommits(token: string, owner: string, repo: string) {
  return githubFetch<GitHubCommit[]>(`/repos/${owner}/${repo}/commits?per_page=100`, token);
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  stats?: {
    additions: number;
    deletions: number;
  };
}

export async function getGithubRepoTree(token: string, owner: string, repo: string, branch = "main") {
  try {
    return await githubFetch<{ tree: Array<{ path: string; type: string; url: string; size?: number }> }>(
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token
    );
  } catch {
    try {
      return await githubFetch<{ tree: Array<{ path: string; type: string; url: string; size?: number }> }>(
        `/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        token
      );
    } catch {
      return { tree: [] };
    }
  }
}

export async function getGithubFileContent(token: string, owner: string, repo: string, path: string) {
  return githubFetch<{ content: string; encoding: string }>(
    `/repos/${owner}/${repo}/contents/${path}`,
    token
  );
}
