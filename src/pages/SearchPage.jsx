import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Mail, Calendar, MessageSquare, FileText, Globe, Loader2, FolderOpen } from 'lucide-react';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); doSearch(q); }
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      doSearch(query.trim());
    }
  };

  const gmailResults = results?.gmail?.threads || [];
  const notionResults = results?.notion?.results || [];
  const fileResults = results?.files || [];
  const calendarResults = results?.calendar?.events || [];
  const slackChannels = results?.slack?.channels || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-h3 font-bold">Unified Search</h1>
        <p className="text-text-muted text-sm mt-1">Search across Gmail, Calendar, Slack, Notion, and local files</p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          type="text"
          placeholder="Search across all sources..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="input w-full pl-11 pr-4 py-3 text-base"
          autoFocus
        />
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span>Searching across all sources...</span>
        </div>
      )}

      {results && !loading && (
        <div className="space-y-6">
          {/* Local Files */}
          {fileResults.length > 0 && (
            <ResultSection icon={FolderOpen} title="Local Accounts" count={fileResults.length} color="brand-success">
              {fileResults.map((f, i) => (
                <Link key={i} to={`/accounts/${encodeURIComponent(f.name)}`} className="block p-3 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-blue transition-colors">
                  <p className="text-sm font-medium text-text-primary">{f.name}</p>
                  <p className="text-caption text-text-muted">Local account folder</p>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Notion */}
          {notionResults.length > 0 && (
            <ResultSection icon={Globe} title="Notion" count={notionResults.length} color="brand-blue">
              {notionResults.map((r, i) => (
                <Link key={i} to={`/accounts/${encodeURIComponent(r.title)}`} className="block p-3 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-blue transition-colors">
                  <p className="text-sm font-medium text-text-primary">{r.title}</p>
                  {r.highlight && <p className="text-caption text-text-muted mt-1">{r.highlight}</p>}
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Gmail */}
          {gmailResults.length > 0 && (
            <ResultSection icon={Mail} title="Gmail" count={gmailResults.length} color="brand-warning">
              {gmailResults.map((email, i) => (
                <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                  <p className="text-sm font-medium text-text-primary">{email.subject}</p>
                  <p className="text-caption text-text-muted">{email.from} — {email.date ? new Date(email.date).toLocaleDateString() : ''}</p>
                </div>
              ))}
            </ResultSection>
          )}

          {/* Calendar */}
          {calendarResults.length > 0 && (
            <ResultSection icon={Calendar} title="Calendar" count={calendarResults.length} color="brand-blue-secondary">
              {calendarResults.map((evt, i) => (
                <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                  <p className="text-sm font-medium text-text-primary">{evt.summary}</p>
                  <p className="text-caption text-text-muted">{evt.start ? new Date(evt.start).toLocaleString() : ''}</p>
                </div>
              ))}
            </ResultSection>
          )}

          {/* Slack */}
          {slackChannels.length > 0 && (
            <ResultSection icon={MessageSquare} title="Slack Channels" count={slackChannels.length} color="purple-400">
              {slackChannels.map((ch, i) => (
                <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                  <p className="text-sm font-medium text-text-primary">#{ch.name}</p>
                  {ch.purpose && <p className="text-caption text-text-muted">{ch.purpose}</p>}
                </div>
              ))}
            </ResultSection>
          )}

          {/* No results */}
          {gmailResults.length === 0 && notionResults.length === 0 && fileResults.length === 0 && calendarResults.length === 0 && slackChannels.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <Search size={40} className="mx-auto mb-3 opacity-20" />
              <p>No results found for "{query}"</p>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-16 text-text-muted">
          <Search size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Search across all your connected sources</p>
          <p className="text-sm mt-1">Gmail, Calendar, Slack, Notion, and local account files</p>
        </div>
      )}
    </div>
  );
}

function ResultSection({ icon: Icon, title, count, color, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={`text-${color}`} />
        <h3 className="text-h5 font-semibold">{title}</h3>
        {count !== null && <span className="badge badge-gray">{count}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
