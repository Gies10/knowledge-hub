import { base64ToUtf8, utf8ToBase64 } from './base64';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export interface RemoteFile {
  path: string;
  sha: string;
  content: string;
}

export interface RemoteFileMeta {
  name: string;
  path: string;
  sha: string;
}

export const NOTES_DIR = 'notes';

export function notePath(id: string): string {
  return `${NOTES_DIR}/${id}.md`;
}

const API_BASE = 'https://api.github.com';

export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function authHeaders(config: GitHubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function request(config: GitHubConfig, path: string, init?: RequestInit): Promise<Response> {
  // Sync correctness depends on always seeing the current server state (SHAs,
  // listings) - a stale cached GET here silently reintroduces the exact
  // staleness this whole layer exists to detect and resolve.
  return fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...authHeaders(config), ...(init?.headers ?? {}) },
  });
}

/** Confirms the token can read/write this repo. Throws a readable error otherwise. */
export async function validateAccess(config: GitHubConfig): Promise<void> {
  const res = await request(config, `/repos/${config.owner}/${config.repo}`);
  if (res.status === 401) throw new GitHubApiError(401, 'Invalid or expired token.');
  if (res.status === 404) {
    throw new GitHubApiError(404, `Repo "${config.owner}/${config.repo}" not found, or this token can't see it.`);
  }
  if (!res.ok) throw new GitHubApiError(res.status, `GitHub error ${res.status}: ${await res.text()}`);
}

export async function listNoteFiles(config: GitHubConfig): Promise<RemoteFileMeta[]> {
  const res = await request(config, `/repos/${config.owner}/${config.repo}/contents/${NOTES_DIR}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to list notes: ${await res.text()}`);
  const data = (await res.json()) as Array<{ name: string; path: string; sha: string; type: string }>;
  return data
    .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
    .map((f) => ({ name: f.name, path: f.path, sha: f.sha }));
}

export async function getFile(config: GitHubConfig, path: string): Promise<RemoteFile | null> {
  const res = await request(config, `/repos/${config.owner}/${config.repo}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to fetch ${path}: ${await res.text()}`);
  const data = (await res.json()) as { content: string; sha: string };
  return { path, sha: data.sha, content: base64ToUtf8(data.content) };
}

export async function putFile(
  config: GitHubConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ sha: string }> {
  const res = await request(config, `/repos/${config.owner}/${config.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: utf8ToBase64(content), sha }),
  });
  if (!res.ok) {
    if (res.status === 409) throw new GitHubApiError(409, `Conflict writing ${path} (it changed remotely).`);
    throw new GitHubApiError(res.status, `Failed to write ${path}: ${await res.text()}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}

export async function deleteFile(config: GitHubConfig, path: string, sha: string, message: string): Promise<void> {
  const res = await request(config, `/repos/${config.owner}/${config.repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok && res.status !== 404) {
    throw new GitHubApiError(res.status, `Failed to delete ${path}: ${await res.text()}`);
  }
}
