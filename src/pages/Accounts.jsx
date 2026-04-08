import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Grid, List, ArrowUpDown, Trash2, X, AlertTriangle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { mergeAccounts, getStatusClass, getTierColor, getScoreColor, formatDate } from '../utils/helpers';

export default function Accounts() {
  const { state, dispatch, apiDelete } = useApp();
  const { data: notionData, loading: notionLoading, refetch: refetchNotion } = useApi('/api/notion/accounts');
  const { data: localData, loading: localLoading, refetch: refetchLocal } = useApi('/api/files/accounts');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const accounts = useMemo(() => {
    const notion = notionData?.results || [];
    const local = localData?.accounts || [];
    return mergeAccounts(notion, local);
  }, [notionData, localData]);

  useEffect(() => {
    dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
  }, [accounts]);

  const filtered = useMemo(() => {
    let result = accounts;
    if (search) result = result.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || (a.mainContact || '').toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (tierFilter !== 'all') result = result.filter(a => a.tier === tierFilter);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      else if (sortBy === 'tier') cmp = (a.tier || '').localeCompare(b.tier || '');
      else if (sortBy === 'score') cmp = (parseInt(b.score) || 0) - (parseInt(a.score) || 0);
      else if (sortBy === 'added') cmp = new Date(b.added || 0) - new Date(a.added || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [accounts, search, statusFilter, tierFilter, sortBy, sortDir]);

  const loading = notionLoading || localLoading;

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/accounts/${encodeURIComponent(deleteTarget)}`);
      dispatch({ type: 'DELETE_ACCOUNT', payload: deleteTarget });
      // Refetch data to stay in sync
      refetchNotion();
      refetchLocal();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-error/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-brand-error" />
              </div>
              <div>
                <h3 className="text-h5 font-semibold text-text-primary">Delete Account</h3>
                <p className="text-sm text-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to delete <strong className="text-text-primary">{deleteTarget}</strong>? This will remove it from the accounts list.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="bg-brand-error text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-error/80 transition-all duration-150 flex items-center gap-2">
                {deleting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 size={14} /> Delete Account</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-bold">Accounts</h1>
          <p className="text-text-muted text-sm mt-1">{filtered.length} of {accounts.length} accounts</p>
        </div>
        <Link to="/add" className="btn-primary flex items-center gap-2">
          <Users size={16} /> Add Account
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input type="text" placeholder="Filter accounts..." value={search} onChange={e => setSearch(e.target.value)} className="input w-full pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input">
          <option value="all">All Statuses</option>
          {['Incoming', 'Onboarding', 'Implementation', 'Adoption', 'Expansion', 'Lost'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="input">
          <option value="all">All Tiers</option>
          {['High', 'Medium', 'Low'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-1 border border-brand-border rounded-lg p-0.5">
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-brand-elevated text-text-primary' : 'text-text-muted'}`}><List size={16} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-brand-elevated text-text-primary' : 'text-text-muted'}`}><Grid size={16} /></button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-text-muted">Loading accounts...</div>}

      {/* Table View */}
      {!loading && viewMode === 'table' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg/50">
                  {[
                    { key: 'name', label: 'Account Name' },
                    { key: 'status', label: 'Status' },
                    { key: 'tier', label: 'Tier' },
                    { key: 'score', label: 'Score' },
                    { key: 'mainContact', label: 'Main Contact' },
                    { key: 'added', label: 'Added' },
                  ].map(col => (
                    <th key={col.key} className="px-4 py-3 text-left font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors" onClick={() => toggleSort(col.key)}>
                      <span className="flex items-center gap-1">{col.label} {sortBy === col.key && <ArrowUpDown size={12} />}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Source</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => (
                  <tr key={acc.id} className="border-b border-brand-border/30 hover:bg-brand-elevated/50 transition-colors group">
                    <td className="px-4 py-3">
                      <Link to={`/accounts/${encodeURIComponent(acc.name)}`} className="text-text-primary hover:text-brand-blue font-medium transition-colors">
                        {acc.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><span className={`badge ${getStatusClass(acc.status)}`}>{acc.status}</span></td>
                    <td className="px-4 py-3">{acc.tier ? <span className={`badge ${getTierColor(acc.tier)}`}>{acc.tier}</span> : '—'}</td>
                    <td className="px-4 py-3">{acc.score ? <span className={`font-bold ${getScoreColor(acc.score)}`}>{acc.score}/5</span> : '—'}</td>
                    <td className="px-4 py-3 text-text-muted max-w-[200px] truncate">{acc.mainContact || '—'}</td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(acc.added)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(acc.source === 'notion' || acc.source === 'both') && <span className="badge badge-blue">Notion</span>}
                        {(acc.source === 'local' || acc.source === 'both') && <span className="badge badge-green">Files</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(acc.name); }}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-brand-error transition-all duration-150 p-1 rounded hover:bg-brand-error/10"
                        title={`Delete ${acc.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {!loading && viewMode === 'grid' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(acc => (
            <div key={acc.id} className="card group cursor-pointer relative">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(acc.name); }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-dim hover:text-brand-error transition-all duration-150 p-1.5 rounded-lg hover:bg-brand-error/10"
                title={`Delete ${acc.name}`}
              >
                <Trash2 size={14} />
              </button>
              <Link to={`/accounts/${encodeURIComponent(acc.name)}`} className="block">
                <div className="flex items-start justify-between mb-3 pr-6">
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-blue transition-colors">{acc.name}</h3>
                  {acc.score && <span className={`text-lg font-bold ${getScoreColor(acc.score)}`}>{acc.score}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`badge ${getStatusClass(acc.status)}`}>{acc.status}</span>
                  {acc.tier && <span className={`badge ${getTierColor(acc.tier)}`}>{acc.tier}</span>}
                </div>
                {acc.mainContact && <p className="text-caption text-text-muted truncate">{acc.mainContact}</p>}
                <div className="flex gap-1 mt-2">
                  {(acc.source === 'notion' || acc.source === 'both') && <span className="badge badge-blue text-[10px]">Notion</span>}
                  {(acc.source === 'local' || acc.source === 'both') && <span className="badge badge-green text-[10px]">Files</span>}
                  {acc.hasLocalFiles && <span className="text-caption text-text-dim">{acc.localFiles?.length || 0} files</span>}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>No accounts match your filters</p>
        </div>
      )}
    </div>
  );
}
