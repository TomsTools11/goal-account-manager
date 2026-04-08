import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckSquare, Calendar, Mail, ArrowRight, AlertCircle, Clock, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { mergeAccounts, formatDateTime, timeAgo, getStatusClass, getTierColor } from '../utils/helpers';

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { data: notionData, loading: notionLoading, refetch: refetchNotion } = useApi('/api/notion/accounts');
  const { data: localData, loading: localLoading, refetch: refetchLocal } = useApi('/api/files/accounts');
  const { data: calendarData, refetch: refetchCalendar } = useApi('/api/calendar/events');
  const { data: emailData, refetch: refetchGmail } = useApi('/api/gmail/search');

  const [accounts, setAccounts] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const notion = notionData?.results || [];
    const local = localData?.accounts || [];
    const merged = mergeAccounts(notion, local);
    setAccounts(merged);
    dispatch({ type: 'SET_ACCOUNTS', payload: merged });
    dispatch({ type: 'SET_NOTION_ACCOUNTS', payload: notion });
    dispatch({ type: 'SET_LOCAL_ACCOUNTS', payload: local });
  }, [notionData, localData]);

  const handleSync = async () => {
    setSyncing(true);
    await Promise.all([refetchNotion(), refetchLocal(), refetchCalendar(), refetchGmail()]);
    setSyncing(false);
  };

  const loading = notionLoading || localLoading;
  const tasks = state.tasks.filter(t => !t.completed);
  const statusCounts = accounts.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  const events = calendarData?.events || [];
  const emails = emailData?.threads || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-bold">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">Overview of your accounts and upcoming activities</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2">
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Accounts" value={accounts.length} color="brand-blue" loading={loading} />
        <StatCard icon={TrendingUp} label="Active" value={(statusCounts['Onboarding'] || 0) + (statusCounts['Implementation'] || 0) + (statusCounts['Adoption'] || 0) + (statusCounts['Expansion'] || 0)} color="brand-success" />
        <StatCard icon={CheckSquare} label="Open Tasks" value={tasks.length} color="brand-warning" />
        <StatCard icon={Calendar} label="Upcoming" value={events.length} color="brand-blue-secondary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Accounts by Status */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">By Status</h3>
            <Link to="/accounts" className="text-brand-blue text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {['Onboarding', 'Implementation', 'Adoption', 'Expansion', 'Incoming', 'Lost'].map(status => (
              <div key={status} className="flex items-center justify-between py-1.5">
                <span className={`badge ${getStatusClass(status)}`}>{status}</span>
                <span className="text-text-primary font-medium text-sm">{statusCounts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">Upcoming Events</h3>
            <Calendar size={16} className="text-text-muted" />
          </div>
          <div className="space-y-3">
            {events.length === 0 && <p className="text-text-dim text-sm">No upcoming events</p>}
            {events.slice(0, 5).map((evt, i) => (
              <div key={i} className="flex gap-3 py-1.5 border-b border-brand-border/50 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-brand-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{evt.summary}</p>
                  <p className="text-caption text-text-muted">{formatDateTime(evt.start)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Emails */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">Recent Emails</h3>
            <Mail size={16} className="text-text-muted" />
          </div>
          <div className="space-y-3">
            {emails.length === 0 && <p className="text-text-dim text-sm">No recent emails</p>}
            {emails.slice(0, 5).map((email, i) => (
              <div key={i} className="flex gap-3 py-1.5 border-b border-brand-border/50 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-brand-warning/10 flex items-center justify-center flex-shrink-0">
                  <Mail size={16} className="text-brand-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{email.subject}</p>
                  <p className="text-caption text-text-muted truncate">{email.from}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Accounts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h5 font-semibold">Accounts</h3>
          <Link to="/accounts" className="btn-ghost flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-text-muted text-left">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Contact</th>
                <th className="pb-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {accounts.slice(0, 10).map(acc => (
                <tr key={acc.id} className="border-b border-brand-border/30 hover:bg-brand-elevated/50 transition-colors">
                  <td className="py-2.5">
                    <Link to={`/accounts/${encodeURIComponent(acc.name)}`} className="text-text-primary hover:text-brand-blue transition-colors font-medium">
                      {acc.name}
                    </Link>
                  </td>
                  <td><span className={`badge ${getStatusClass(acc.status)}`}>{acc.status}</span></td>
                  <td>{acc.tier && <span className={`badge ${getTierColor(acc.tier)}`}>{acc.tier}</span>}</td>
                  <td className="text-text-primary">{acc.score || '—'}</td>
                  <td className="text-text-muted truncate max-w-[200px]">{acc.mainContact || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      {(acc.source === 'notion' || acc.source === 'both') && <span className="badge badge-blue">Notion</span>}
                      {(acc.source === 'local' || acc.source === 'both') && <span className="badge badge-green">Files</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl bg-${color}/15 flex items-center justify-center`}>
        <Icon size={20} className={`text-${color}`} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-text-primary">{loading ? '...' : value}</p>
        <p className="text-caption text-text-muted">{label}</p>
      </div>
    </div>
  );
}
