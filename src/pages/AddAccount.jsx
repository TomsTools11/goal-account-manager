import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AddAccount() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('manual'); // manual | search
  const [form, setForm] = useState({ name: '', status: 'Incoming', tier: 'Medium', mainContact: '', accountScore: '3' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/notion/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) {
        setResult({ type: 'error', message: data.error });
      } else {
        setResult({ type: 'success', message: `Account "${form.name}" created successfully` });
        setTimeout(() => navigate('/accounts'), 1500);
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      // Search Close CRM
      const closeRes = await fetch(`/api/close/leads?query=${encodeURIComponent(searchQuery)}&limit=10`);
      const closeData = await closeRes.json();
      
      // Search Notion
      const notionRes = await fetch(`/api/notion/search?q=${encodeURIComponent(searchQuery)}`);
      const notionData = await notionRes.json();

      setSearchResults({ close: closeData, notion: notionData });
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const selectFromClose = (lead) => {
    setForm({
      name: lead.display_name || lead.name || '',
      status: 'Incoming',
      tier: 'Medium',
      mainContact: lead.contacts?.[0]?.emails?.[0]?.email || '',
      accountScore: '3'
    });
    setMode('manual');
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-h3 font-bold">Add Account</h1>
        <p className="text-text-muted text-sm mt-1">Add a new account to your Notion database</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 border border-brand-border rounded-lg p-0.5 w-fit">
        <button onClick={() => setMode('manual')} className={`px-4 py-1.5 rounded text-sm ${mode === 'manual' ? 'bg-brand-elevated text-text-primary' : 'text-text-muted'}`}>Manual Entry</button>
        <button onClick={() => setMode('search')} className={`px-4 py-1.5 rounded text-sm ${mode === 'search' ? 'bg-brand-elevated text-text-primary' : 'text-text-muted'}`}>Search & Import</button>
      </div>

      {/* Search Mode */}
      {mode === 'search' && (
        <div className="card">
          <h3 className="text-h5 font-semibold mb-3">Search Close CRM & Notion</h3>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input type="text" placeholder="Search for a lead or account..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input flex-1" />
            <button type="submit" disabled={searching} className="btn-primary flex items-center gap-1">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </form>

          {searchResults && (
            <div className="space-y-4">
              {/* Close CRM Results */}
              <div>
                <h4 className="text-sm font-semibold text-text-muted mb-2">Close CRM</h4>
                {searchResults.close?.error ? (
                  <p className="text-text-dim text-sm">{searchResults.close.error}</p>
                ) : searchResults.close?.data?.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.close.data.map((lead, i) => (
                      <button key={i} onClick={() => selectFromClose(lead)} className="w-full text-left p-3 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-blue transition-colors">
                        <p className="text-sm font-medium text-text-primary">{lead.display_name || lead.name}</p>
                        {lead.contacts?.[0]?.emails?.[0]?.email && (
                          <p className="text-caption text-text-muted">{lead.contacts[0].emails[0].email}</p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-dim text-sm">No results from Close CRM</p>
                )}
              </div>

              {/* Notion Results */}
              <div>
                <h4 className="text-sm font-semibold text-text-muted mb-2">Notion</h4>
                {searchResults.notion?.results?.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.notion.results.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                        <p className="text-sm font-medium text-text-primary">{r.title}</p>
                        {r.highlight && <p className="text-caption text-text-muted">{r.highlight}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-dim text-sm">No results from Notion</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Form */}
      {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="text-sm text-text-muted mb-1 block">Account Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="e.g., Sullivan Financial Group LLC" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input w-full">
                {['Incoming', 'Onboarding', 'Implementation', 'Adoption', 'Expansion', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Tier</label>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="input w-full">
                {['High', 'Medium', 'Low'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Main Contact Email</label>
              <input type="email" value={form.mainContact} onChange={e => setForm({ ...form, mainContact: e.target.value })} className="input w-full" placeholder="contact@agency.com" />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Account Score</label>
              <select value={form.accountScore} onChange={e => setForm({ ...form, accountScore: e.target.value })} className="input w-full">
                {['5', '4', '3', '2', '1'].map(s => <option key={s} value={s}>{s}/5</option>)}
              </select>
            </div>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${result.type === 'success' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'}`}>
              {result.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            {saving ? 'Creating...' : 'Create Account in Notion'}
          </button>
        </form>
      )}
    </div>
  );
}
