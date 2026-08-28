import { useState } from 'react';
import type { useSync } from '../hooks/useSync';

interface SyncSettingsProps {
  sync: ReturnType<typeof useSync>;
  onClose: () => void;
}

export function SyncSettings({ sync, onClose }: SyncSettingsProps) {
  const [owner, setOwner] = useState(sync.owner ?? '');
  const [repo, setRepo] = useState(sync.repo ?? 'knowledge-hub-notes');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await sync.connect({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
      setToken('');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal sync-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sync with GitHub</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {sync.connected ? (
          <div className="sync-connected">
            <p>
              Connected to <strong>{sync.owner}/{sync.repo}</strong>
            </p>
            <p className={`sync-status sync-status-${sync.status}`}>
              {sync.status === 'syncing' && 'Syncing…'}
              {sync.status === 'idle' &&
                (sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : 'Idle')}
              {sync.status === 'error' && `Error: ${sync.error}`}
              {sync.status === 'connecting' && 'Connecting…'}
            </p>
            <div className="sync-actions">
              <button
                type="button"
                className="new-note-button"
                onClick={() => void sync.syncNow()}
                disabled={sync.status === 'syncing'}
              >
                Sync now
              </button>
              <button type="button" className="icon-button danger" onClick={sync.disconnect} aria-label="Disconnect">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="sync-setup">
            <ol className="sync-instructions">
              <li>Create a private GitHub repo for your notes (or use one you already made).</li>
              <li>
                Create a{' '}
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                  fine-grained personal access token
                </a>{' '}
                scoped to just that repo, with <strong>Contents: Read and write</strong> permission.
              </li>
              <li>Paste your details below.</li>
            </ol>
            <label className="sync-field">
              GitHub username
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. octocat" />
            </label>
            <label className="sync-field">
              Repo name
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="knowledge-hub-notes" />
            </label>
            <label className="sync-field">
              Personal access token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_…"
              />
            </label>
            {connectError && <p className="sync-error">{connectError}</p>}
            <button
              type="button"
              className="new-note-button"
              onClick={() => void handleConnect()}
              disabled={connecting || !owner.trim() || !repo.trim() || !token.trim()}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <p className="sync-disclaimer">
              The token is stored only in this browser's local storage, and used only to talk directly to GitHub's
              API.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
