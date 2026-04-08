import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, CheckCircle, XCircle, RefreshCw, Loader2, ExternalLink, LogIn, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [flash, setFlash] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Show flash message from OAuth redirect
    if (searchParams.get('connected') === 'google') {
      setFlash({ type: 'success', message: 'Google account connected successfully!' });
    } else if (searchParams.get('error')) {
      setFlash({ type: 'error', message: `Google connection failed: ${searchParams.get('error')}` });
    }
  }, []);

  const disconnectGoogle = async () => {
    setDisconnecting(true);
    try {
      await fetch('/auth/google/disconnect', { method: 'POST' });
      await checkHealth();
      setFlash({ type: 'success', message: 'Google account disconnected.' });
    } catch (err) {
      setFlash({ type: 'error', message: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const services = health?.services || {};

  const serviceList = [
    {
      key: 'google', name: 'Google (Gmail + Calendar)',
      desc: 'Live email search and calendar events via Google API',
      hasAction: true,
    },
    { key: 'slack', name: 'Slack', desc: 'Live channel listing and search via Slack API' },
    { key: 'notion', name: 'Notion', desc: 'Live accounts database via Notion API' },
    { key: 'files', name: 'Local Files', desc: ACCOUNTS_DIR_DISPLAY },
    { key: 'close', name: 'Close CRM', desc: 'Lead search and management via REST API' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-h3 font-bold">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Connection status and configuration</p>
      </div>

      {/* Flash Message */}
      {flash && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${flash.type === 'success' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'}`}>
          {flash.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{flash.message}</span>
          <button onClick={() => setFlash(null)} className="ml-auto text-text-muted hover:text-text-primary">&times;</button>
        </div>
      )}

      {/* Connection Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h5 font-semibold">Service Connections</h3>
          <button onClick={checkHealth} disabled={loading} className="btn-ghost flex items-center gap-1">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {health?.error && (
          <div className="p-3 rounded-lg bg-brand-error/10 text-brand-error text-sm mb-4">
            Server not reachable: {health.error}
          </div>
        )}

        <div className="space-y-3">
          {serviceList.map(svc => (
            <div key={svc.key} className="flex items-center gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50">
              {services[svc.key] ? (
                <CheckCircle size={18} className="text-brand-success flex-shrink-0" />
              ) : (
                <XCircle size={18} className="text-brand-error flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{svc.name}</p>
                <p className="text-caption text-text-muted">{svc.desc}</p>
              </div>
              {svc.key === 'google' && !services.google && (
                <a href="http://localhost:3001/auth/google" className="btn-primary text-sm flex items-center gap-1.5 no-underline">
                  <LogIn size={14} /> Connect Google
                </a>
              )}
              {svc.key === 'google' && services.google && (
                <button onClick={disconnectGoogle} disabled={disconnecting} className="btn-ghost text-sm flex items-center gap-1.5 text-brand-error hover:text-brand-error">
                  {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Disconnect
                </button>
              )}
              {svc.key !== 'google' && (
                <span className={`badge ${services[svc.key] ? 'badge-green' : 'badge-red'}`}>
                  {services[svc.key] ? 'Connected' : 'Not configured'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="card">
        <h3 className="text-h5 font-semibold mb-4">Configuration</h3>
        <p className="text-sm text-text-muted mb-4">Add these to the <code className="bg-brand-form px-1.5 py-0.5 rounded text-text-secondary">.env</code> file in the project root:</p>
        <pre className="bg-brand-form p-4 rounded-lg text-sm text-text-secondary overflow-x-auto leading-relaxed">{`# Google OAuth2 (for Gmail + Calendar)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Notion
NOTION_API_KEY=ntn_your_api_key
NOTION_DATABASE_ID=your_database_id

# Close CRM
CLOSE_API_KEY=your_api_key

# Local accounts folder (optional)
ACCOUNTS_DIR=~/GOAL/My Accounts`}</pre>
      </div>

      {/* PWA Install */}
      <div className="card">
        <h3 className="text-h5 font-semibold mb-3">Install as Desktop App</h3>
        <p className="text-sm text-text-muted mb-3">
          Click the install icon in Chrome's address bar, or: <strong>Chrome &rarr; More Tools &rarr; Create Shortcut &rarr; Open as window</strong>.
        </p>
        <div className="p-3 rounded-lg bg-brand-blue/10 text-brand-blue text-sm">
          After building for production, the PWA will be fully installable with offline support.
        </div>
      </div>

      {/* About */}
      <div className="card">
        <h3 className="text-h5 font-semibold mb-2">About</h3>
        <p className="text-sm text-text-muted">
          GOAL Account Manager v1.0 — Unified account management with live integrations for Close CRM, Gmail, Google Calendar, Slack, Notion, and local files.
        </p>
        {health?.time && <p className="text-caption text-text-dim mt-2">Server time: {new Date(health.time).toLocaleString()}</p>}
      </div>
    </div>
  );
}

const ACCOUNTS_DIR_DISPLAY = '~/GOAL/My Accounts';
