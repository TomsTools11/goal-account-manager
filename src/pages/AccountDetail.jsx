import React, { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Calendar, MessageSquare, FileText, Globe, Table,
  ExternalLink, FolderOpen, CheckSquare, Plus, Clock, Zap, Image, Code, File,
  Trash2, AlertTriangle, RefreshCw, Sparkles, ArrowRight
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { mergeAccounts, getStatusClass, getTierColor, getScoreColor, formatDate, formatDateTime, formatBytes, fileIcon as getFileIconName } from '../utils/helpers';

const FILE_ICONS = { FileText, Table, Globe, Zap, Image, Code, File };

const SOURCE_ICONS = { email: Mail, calendar: Calendar, slack: MessageSquare, files: FolderOpen };
const SOURCE_COLORS = { email: 'text-brand-warning', calendar: 'text-brand-blue', slack: 'text-purple-400', files: 'text-brand-success' };
const PRIORITY_STYLES = { high: 'bg-brand-error/15 text-brand-error', medium: 'bg-brand-warning/15 text-brand-warning', low: 'bg-brand-blue/15 text-brand-blue' };

export default function AccountDetail() {
  const { id } = useParams();
  const accountName = decodeURIComponent(id);
  const navigate = useNavigate();
  const { state, dispatch, apiDelete } = useApp();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Data fetching — emails, calendar, slack are lazy-loaded on button click
  const { data: notionData } = useApi('/api/notion/accounts');
  const { data: localData } = useApi('/api/files/accounts');
  const { data: filesData } = useApi(`/api/files/account/${encodeURIComponent(accountName)}`);

  // Lazy-loaded data
  const [emailData, setEmailData] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [slackData, setSlackData] = useState(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [newTask, setNewTask] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/api/accounts/${encodeURIComponent(accountName)}`);
      dispatch({ type: 'DELETE_ACCOUNT', payload: accountName });
      navigate('/accounts');
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const account = useMemo(() => {
    const notion = notionData?.results || [];
    const local = localData?.accounts || [];
    const merged = mergeAccounts(notion, local);
    return merged.find(a => a.name.toLowerCase() === accountName.toLowerCase()) || { name: accountName, status: 'Unknown', source: 'search' };
  }, [notionData, localData, accountName]);

  const accountTasks = state.tasks.filter(t => t.account?.toLowerCase() === accountName.toLowerCase());
  const emails = emailData?.threads || [];
  const events = calendarData?.events || [];
  const files = filesData?.files || account.localFiles || [];
  const slackChannels = slackData?.channels || [];
  const suggestedTasks = scanData?.tasks || [];

  // Action button handlers
  const handleGetEmails = useCallback(async () => {
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(accountName)}`);
      const data = await res.json();
      setEmailData(data);
      setActiveTab('emails');
    } catch (err) { console.error(err); }
    finally { setEmailLoading(false); }
  }, [accountName]);

  const handleGetCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetch(`/api/calendar/events?q=${encodeURIComponent(accountName)}`);
      const data = await res.json();
      setCalendarData(data);
      setActiveTab('calendar');
    } catch (err) { console.error(err); }
    finally { setCalLoading(false); }
  }, [accountName]);

  const handleGetSlack = useCallback(async () => {
    setSlackLoading(true);
    try {
      const res = await fetch(`/api/slack/search?q=${encodeURIComponent(accountName)}`);
      const data = await res.json();
      setSlackData(data);
      setActiveTab('slack');
    } catch (err) { console.error(err); }
    finally { setSlackLoading(false); }
  }, [accountName]);

  const handleGetTasks = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await fetch(`/api/account/${encodeURIComponent(accountName)}/scan-tasks`);
      const data = await res.json();
      setScanData(data);
      setActiveTab('suggested');
    } catch (err) { console.error(err); }
    finally { setScanLoading(false); }
  }, [accountName]);

  const handleAddSuggestedTask = (task) => {
    dispatch({ type: 'ADD_TASK', payload: { title: task.title, account: accountName, completed: false, priority: task.priority, source: task.source } });
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    dispatch({ type: 'ADD_TASK', payload: { title: newTask.trim(), account: accountName, completed: false, priority: 'medium' } });
    setNewTask('');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'emails', label: 'Emails', icon: Mail, count: emails.length },
    { id: 'calendar', label: 'Calendar', icon: Calendar, count: events.length },
    { id: 'slack', label: 'Slack', icon: MessageSquare, count: slackChannels.length },
    { id: 'files', label: 'Files', icon: FolderOpen, count: files.length },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: accountTasks.length },
    ...(suggestedTasks.length > 0 ? [{ id: 'suggested', label: 'Suggested Tasks', icon: Sparkles, count: suggestedTasks.length }] : []),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
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
              Are you sure you want to delete <strong className="text-text-primary">{accountName}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="bg-brand-error text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-error/80 transition-all duration-150 flex items-center gap-2">
                {deleting ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>) : (<><Trash2 size={14} /> Delete Account</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/accounts" className="text-text-muted hover:text-text-primary transition-colors"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-h3 font-bold">{account.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${getStatusClass(account.status)}`}>{account.status}</span>
            {account.tier && <span className={`badge ${getTierColor(account.tier)}`}>{account.tier}</span>}
            {account.score && <span className={`text-sm font-bold ${getScoreColor(account.score)}`}>Score: {account.score}/5</span>}
            {account.notionUrl && (
              <a href={account.notionUrl} target="_blank" rel="noopener" className="text-brand-blue text-sm hover:underline flex items-center gap-1">
                Open in Notion <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
        <button onClick={() => setShowDeleteModal(true)} className="text-text-dim hover:text-brand-error transition-all duration-150 p-2 rounded-lg hover:bg-brand-error/10" title={`Delete ${accountName}`}>
          <Trash2 size={18} />
        </button>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={handleGetEmails} disabled={emailLoading} className="btn-primary flex items-center gap-2 text-sm">
          {emailLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
          {emailLoading ? 'Fetching...' : 'Get Emails'}
        </button>
        <button onClick={handleGetCalendar} disabled={calLoading} className="bg-brand-blue/20 text-brand-blue border border-brand-blue/30 px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-blue/30 transition-all duration-150 flex items-center gap-2">
          {calLoading ? <RefreshCw size={16} className="animate-spin" /> : <Calendar size={16} />}
          {calLoading ? 'Fetching...' : 'Get Events'}
        </button>
        <button onClick={handleGetSlack} disabled={slackLoading} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg font-medium text-sm hover:bg-purple-500/30 transition-all duration-150 flex items-center gap-2">
          {slackLoading ? <RefreshCw size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          {slackLoading ? 'Fetching...' : 'Get Slack Messages'}
        </button>
        <button onClick={handleGetTasks} disabled={scanLoading} className="bg-brand-success/20 text-brand-success border border-brand-success/30 px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-success/30 transition-all duration-150 flex items-center gap-2">
          {scanLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {scanLoading ? 'Scanning...' : 'Get Tasks'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-border mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-text-muted hover:text-text-primary hover:border-brand-border'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count > 0 && <span className="bg-brand-elevated text-text-muted text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-h5 font-semibold mb-4">Account Details</h3>
            <dl className="space-y-3">
              {[
                ['Main Contact', account.mainContact],
                ['Status', account.status],
                ['Tier', account.tier],
                ['Account Score', account.score ? `${account.score}/5` : null],
                ['Contract Start', formatDate(account.contractStart)],
                ['Contract End', formatDate(account.contactEnd)],
                ['Last Contact', formatDate(account.lastContact)],
                ['Added', formatDate(account.added)],
                ['Data Sources', account.source],
              ].map(([label, value]) => value && value !== '—' ? (
                <div key={label} className="flex justify-between py-1 border-b border-brand-border/30">
                  <dt className="text-text-muted text-sm">{label}</dt>
                  <dd className="text-text-primary text-sm font-medium">{value}</dd>
                </div>
              ) : null)}
            </dl>
          </div>
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-h5 font-semibold mb-3">Activity Summary</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xl font-bold text-text-primary">{emails.length}</p><p className="text-caption text-text-muted">Emails</p></div>
                <div><p className="text-xl font-bold text-text-primary">{events.length}</p><p className="text-caption text-text-muted">Events</p></div>
                <div><p className="text-xl font-bold text-text-primary">{files.length}</p><p className="text-caption text-text-muted">Files</p></div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-h5 font-semibold mb-3">Tasks</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-text-primary">{accountTasks.length}</p>
                  <p className="text-caption text-text-muted">Active tasks</p>
                </div>
                <button onClick={() => setActiveTab('tasks')} className="btn-secondary text-sm flex items-center gap-1">
                  View All <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">Emails mentioning "{accountName}"</h3>
            <button onClick={handleGetEmails} disabled={emailLoading} className="btn-secondary text-sm flex items-center gap-1">
              <RefreshCw size={14} className={emailLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {emailLoading && <p className="text-text-muted text-sm">Searching emails...</p>}
          {!emailLoading && emails.length === 0 && <p className="text-text-dim text-sm">No emails found. Click "Get Emails" above to search.</p>}
          <div className="space-y-3">
            {emails.map((email, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-border transition-colors">
                <div className="w-10 h-10 rounded-lg bg-brand-warning/10 flex items-center justify-center flex-shrink-0">
                  <Mail size={16} className="text-brand-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{email.subject}</p>
                  <p className="text-caption text-text-muted mt-0.5">{email.from}</p>
                  <p className="text-caption text-text-dim mt-0.5">{formatDateTime(email.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">Calendar events for "{accountName}"</h3>
            <button onClick={handleGetCalendar} disabled={calLoading} className="btn-secondary text-sm flex items-center gap-1">
              <RefreshCw size={14} className={calLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {calLoading && <p className="text-text-muted text-sm">Searching calendar...</p>}
          {!calLoading && events.length === 0 && <p className="text-text-dim text-sm">No calendar events found. Click "Get Events" above to search.</p>}
          <div className="space-y-3">
            {events.map((evt, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-brand-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{evt.summary}</p>
                  <p className="text-caption text-text-muted mt-0.5">{formatDateTime(evt.start)} — {formatDateTime(evt.end)}</p>
                  {evt.location && <p className="text-caption text-brand-blue mt-0.5">{evt.location}</p>}
                  {evt.attendees && <p className="text-caption text-text-dim mt-0.5">Attendees: {evt.attendees}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'slack' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h5 font-semibold">Slack channels matching "{accountName}"</h3>
            <button onClick={handleGetSlack} disabled={slackLoading} className="btn-secondary text-sm flex items-center gap-1">
              <RefreshCw size={14} className={slackLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {slackLoading && <p className="text-text-muted text-sm">Searching Slack...</p>}
          {!slackLoading && slackChannels.length === 0 && <p className="text-text-dim text-sm">No matching Slack channels found. Click "Get Slack Messages" above to search.</p>}
          <div className="space-y-3">
            {slackChannels.map((ch, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">#{ch.name}</p>
                  {ch.purpose && <p className="text-caption text-text-muted mt-0.5">{ch.purpose}</p>}
                  <p className="text-caption text-text-dim mt-0.5">{ch.type} — Created by {ch.creator}</p>
                </div>
                {ch.permalink && (
                  <a href={ch.permalink} target="_blank" rel="noopener" className="text-brand-blue hover:underline text-sm flex-shrink-0">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="card">
          <h3 className="text-h5 font-semibold mb-4">Local Files</h3>
          {files.length === 0 && <p className="text-text-dim text-sm">No local files found for this account</p>}
          <div className="space-y-2">
            {files.map((file, i) => {
              const iconName = getFileIconName(file.ext);
              const IconComp = FILE_ICONS[iconName] || File;
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-border transition-colors">
                  <IconComp size={18} className="text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{file.name}</p>
                    <p className="text-caption text-text-dim">{file.path}</p>
                  </div>
                  <div className="text-caption text-text-dim flex-shrink-0">{formatBytes(file.size)}</div>
                  <div className="text-caption text-text-dim flex-shrink-0">{formatDate(file.modified)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="card">
          <h3 className="text-h5 font-semibold mb-4">Tasks for {accountName}</h3>
          <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
            <input type="text" placeholder="Add a task..." value={newTask} onChange={e => setNewTask(e.target.value)} className="input flex-1" />
            <button type="submit" className="btn-primary flex items-center gap-1"><Plus size={16} /> Add</button>
          </form>
          <div className="space-y-2">
            {accountTasks.length === 0 && <p className="text-text-dim text-sm">No tasks yet. Use "Get Tasks" to scan for suggested tasks, or add one manually.</p>}
            {accountTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                <button
                  onClick={() => dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, completed: !task.completed } })}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-brand-success border-brand-success' : 'border-brand-border hover:border-brand-blue'}`}
                >
                  {task.completed && <span className="text-white text-xs">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${task.completed ? 'line-through text-text-dim' : 'text-text-primary'}`}>{task.title}</span>
                  {task.source && <span className="ml-2 text-[10px] badge badge-blue">{task.source}</span>}
                </div>
                <span className="text-caption text-text-dim">{formatDate(task.createdAt)}</span>
                <button onClick={() => dispatch({ type: 'DELETE_TASK', payload: task.id })} className="text-text-dim hover:text-brand-error transition-colors text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Tasks from Smart Scanner */}
      {activeTab === 'suggested' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-h5 font-semibold">Suggested Tasks</h3>
                <p className="text-caption text-text-muted mt-1">Scanned emails, calendar, Slack, and files for potential action items</p>
              </div>
              <button onClick={handleGetTasks} disabled={scanLoading} className="btn-secondary text-sm flex items-center gap-1">
                <RefreshCw size={14} className={scanLoading ? 'animate-spin' : ''} /> Re-scan
              </button>
            </div>
            {scanLoading && <p className="text-text-muted text-sm">Scanning all sources...</p>}
            {!scanLoading && suggestedTasks.length === 0 && <p className="text-text-dim text-sm">No suggested tasks found for this account.</p>}
            <div className="space-y-3">
              {suggestedTasks.map((task, i) => {
                const SourceIcon = SOURCE_ICONS[task.source] || Zap;
                const sourceColor = SOURCE_COLORS[task.source] || 'text-text-muted';
                const isAdded = accountTasks.some(t => t.title === task.title);
                return (
                  <div key={i} className="flex gap-3 p-4 rounded-lg bg-brand-bg border border-brand-border/50 hover:border-brand-border transition-colors">
                    <div className={`w-10 h-10 rounded-lg bg-brand-elevated flex items-center justify-center flex-shrink-0`}>
                      <SourceIcon size={16} className={sourceColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-text-primary">{task.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                      </div>
                      <p className="text-caption text-text-muted">{task.detail}</p>
                      {task.date && <p className="text-caption text-text-dim mt-0.5">{formatDateTime(task.date)}</p>}
                    </div>
                    <button
                      onClick={() => handleAddSuggestedTask(task)}
                      disabled={isAdded}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1 ${
                        isAdded
                          ? 'bg-brand-success/20 text-brand-success cursor-default'
                          : 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 border border-brand-blue/30'
                      }`}
                    >
                      {isAdded ? (<><CheckSquare size={14} /> Added</>) : (<><Plus size={14} /> Add Task</>)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
