import React, { useState, useCallback } from 'react';
import { ScanLine, Mail, Calendar, MessageSquare, Plus, CheckSquare, Loader2, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/helpers';

const PRIORITY_STYLES = { high: 'badge-red', medium: 'badge-orange', low: 'badge-green' };

export default function Scanner() {
  const { state, dispatch } = useApp();
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [addedEmails, setAddedEmails] = useState(new Set());
  const [addedEvents, setAddedEvents] = useState(new Set());
  const [addedSlack, setAddedSlack] = useState(new Set());

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanResults(null);
    setSuggestedTasks([]);
    setAddedEmails(new Set());
    setAddedEvents(new Set());
    setAddedSlack(new Set());
    try {
      const url = selectedAccount
        ? `/api/scanner/tasks?account=${encodeURIComponent(selectedAccount)}`
        : '/api/scanner/tasks';
      const res = await fetch(url);
      const data = await res.json();

      // Also fetch Slack channels
      let slackChannels = [];
      try {
        const slackRes = await fetch('/api/slack/channels');
        const slackData = await slackRes.json();
        slackChannels = slackData?.channels || [];
        if (selectedAccount) {
          const q = selectedAccount.toLowerCase();
          slackChannels = slackChannels.filter(ch =>
            ch.name.toLowerCase().includes(q) || (ch.purpose || '').toLowerCase().includes(q)
          );
        }
      } catch (e) {}

      data.slack = { channels: slackChannels };
      setScanResults(data);

      // Generate suggested tasks
      const tasks = [];
      const emails = data.emails?.threads || [];
      const events = data.events?.events || [];

      for (const email of emails) {
        const subject = email.subject || '';
        const subjectLower = subject.toLowerCase();
        const accountGuess = extractAccountFromSubject(subject) || extractAccountFromBody(email.body || email.snippet || '') || selectedAccount;
        if (subjectLower.includes('onboarding')) {
          tasks.push({ title: `Follow up on onboarding: ${subject}`, account: accountGuess, source: 'email', priority: 'high' });
        } else if (subjectLower.includes('budget') && subjectLower.includes('hit')) {
          tasks.push({ title: `Review budget hit: ${subject}`, account: accountGuess, source: 'email', priority: 'high' });
        } else if (subjectLower.includes('rebill')) {
          tasks.push({ title: `Confirm rebill: ${subject}`, account: accountGuess, source: 'email', priority: 'medium' });
        } else if (subjectLower.includes('review') || subjectLower.includes('follow')) {
          tasks.push({ title: `Action needed: ${subject}`, account: accountGuess, source: 'email', priority: 'medium' });
        }
      }

      for (const evt of events) {
        const summary = evt.summary || '';
        const summaryLower = summary.toLowerCase();
        if (summaryLower.includes('onboarding')) {
          const accName = summary.replace(/GOAL Onboarding \|/i, '').trim();
          tasks.push({ title: `Prepare for onboarding: ${accName}`, account: accName || selectedAccount, source: 'calendar', priority: 'high' });
          tasks.push({ title: `Send follow-up after onboarding: ${accName}`, account: accName || selectedAccount, source: 'calendar', priority: 'medium' });
        } else if (summaryLower.includes('account review')) {
          const accName = summary.replace(/GOAL Account Review \|/i, '').trim();
          tasks.push({ title: `Prepare for account review: ${accName}`, account: accName || selectedAccount, source: 'calendar', priority: 'high' });
        } else if (summaryLower.includes('standup') || summaryLower.includes('sync')) {
          tasks.push({ title: `Prepare updates for: ${summary}`, account: '', source: 'calendar', priority: 'low' });
        }
      }

      for (const ch of slackChannels) {
        tasks.push({ title: `Review Slack channel: #${ch.name}`, account: selectedAccount, source: 'slack', priority: 'low' });
      }

      setSuggestedTasks(tasks);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  }, [selectedAccount]);

  const addTask = (task) => {
    dispatch({ type: 'ADD_TASK', payload: { title: task.title, account: task.account, priority: task.priority, completed: false, source: task.source } });
    setSuggestedTasks(prev => prev.filter(t => t !== task));
  };

  const addAllTasks = () => {
    suggestedTasks.forEach(task => {
      dispatch({ type: 'ADD_TASK', payload: { title: task.title, account: task.account, priority: task.priority, completed: false, source: task.source } });
    });
    setSuggestedTasks([]);
  };

  // Add email as a task linked to an account
  const addEmailToAccount = (email, accountName) => {
    const key = `${email.subject}-${email.date}`;
    const acct = accountName || selectedAccount || 'Unassigned';
    dispatch({ type: 'ADD_TASK', payload: {
      title: `Review email: ${email.subject}`,
      account: acct,
      priority: 'medium',
      completed: false,
      source: 'email',
    }});
    setAddedEmails(prev => new Set([...prev, key]));
  };

  // Add event as a task linked to an account
  const addEventToAccount = (evt, accountName) => {
    const key = `${evt.summary}-${evt.start}`;
    const acct = accountName || selectedAccount || 'Unassigned';
    dispatch({ type: 'ADD_TASK', payload: {
      title: `Prep for meeting: ${evt.summary}`,
      account: acct,
      priority: 'high',
      completed: false,
      source: 'calendar',
    }});
    setAddedEvents(prev => new Set([...prev, key]));
  };

  // Add Slack channel check as a task
  const addSlackToAccount = (ch, accountName) => {
    const key = ch.name;
    const acct = accountName || selectedAccount || 'Unassigned';
    dispatch({ type: 'ADD_TASK', payload: {
      title: `Check Slack channel: #${ch.name}`,
      account: acct,
      priority: 'low',
      completed: false,
      source: 'slack',
    }});
    setAddedSlack(prev => new Set([...prev, key]));
  };

  const emails = scanResults?.emails?.threads || [];
  const events = scanResults?.events?.events || [];
  const slackChannels = scanResults?.slack?.channels || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-h3 font-bold">Email, Calendar & Slack Scanner</h1>
        <p className="text-text-muted text-sm mt-1">Scan your emails, calendar, and Slack to discover tasks and link items to accounts</p>
      </div>

      {/* Scan Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-text-muted mb-1 block">Filter by account (optional)</label>
            <input
              type="text"
              placeholder="Account name..."
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="input w-full"
              list="scanner-accounts"
            />
            <datalist id="scanner-accounts">
              {state.accounts.map(a => <option key={a.name} value={a.name} />)}
            </datalist>
          </div>
          <button onClick={runScan} disabled={scanning} className="btn-primary flex items-center gap-2 h-10">
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Suggested Tasks */}
      {suggestedTasks.length > 0 && (
        <div className="card border-brand-blue/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-brand-blue" />
              <h3 className="text-h5 font-semibold">Suggested Tasks ({suggestedTasks.length})</h3>
            </div>
            <button onClick={addAllTasks} className="btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Add All
            </button>
          </div>
          <div className="space-y-2">
            {suggestedTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  task.source === 'email' ? 'bg-brand-warning/10' : task.source === 'slack' ? 'bg-purple-500/10' : 'bg-brand-blue/10'
                }`}>
                  {task.source === 'email' ? <Mail size={14} className="text-brand-warning" /> :
                   task.source === 'slack' ? <MessageSquare size={14} className="text-purple-400" /> :
                   <Calendar size={14} className="text-brand-blue" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.account && (
                      <Link to={`/accounts/${encodeURIComponent(task.account)}`} className="text-caption text-brand-blue hover:underline flex items-center gap-0.5">
                        {task.account} <ArrowRight size={10} />
                      </Link>
                    )}
                  </div>
                </div>
                <span className={`badge ${PRIORITY_STYLES[task.priority]} flex-shrink-0`}>
                  {task.priority}
                </span>
                <button onClick={() => addTask(task)} className="btn-ghost flex items-center gap-1 flex-shrink-0">
                  <Plus size={14} /> Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Results — Emails, Events, Slack in 3-column grid */}
      {scanResults && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Emails */}
          <div className="card">
            <h3 className="text-h5 font-semibold mb-3 flex items-center gap-2"><Mail size={18} className="text-brand-warning" /> Emails ({emails.length})</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {emails.map((email, i) => {
                const key = `${email.subject}-${email.date}`;
                const isAdded = addedEmails.has(key);
                return (
                  <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/30 hover:border-brand-border transition-colors">
                    <p className="text-sm text-text-primary font-medium truncate">{email.subject}</p>
                    <p className="text-caption text-text-muted mt-0.5">{email.from}</p>
                    <p className="text-caption text-text-dim mt-0.5">{formatDateTime(email.date)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => addEmailToAccount(email)}
                        disabled={isAdded}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                          isAdded
                            ? 'bg-brand-success/20 text-brand-success'
                            : 'bg-brand-warning/15 text-brand-warning hover:bg-brand-warning/25 border border-brand-warning/30'
                        }`}
                      >
                        {isAdded ? <><CheckSquare size={12} /> Added</> : <><Plus size={12} /> Add to Account</>}
                      </button>
                    </div>
                  </div>
                );
              })}
              {emails.length === 0 && <p className="text-text-dim text-sm">No relevant emails found</p>}
            </div>
          </div>

          {/* Events */}
          <div className="card">
            <h3 className="text-h5 font-semibold mb-3 flex items-center gap-2"><Calendar size={18} className="text-brand-blue" /> Events ({events.length})</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {events.map((evt, i) => {
                const key = `${evt.summary}-${evt.start}`;
                const isAdded = addedEvents.has(key);
                return (
                  <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/30 hover:border-brand-border transition-colors">
                    <p className="text-sm text-text-primary font-medium truncate">{evt.summary}</p>
                    <p className="text-caption text-text-muted mt-0.5">{formatDateTime(evt.start)}</p>
                    {evt.attendees && <p className="text-caption text-text-dim mt-0.5 truncate">Attendees: {evt.attendees}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => addEventToAccount(evt)}
                        disabled={isAdded}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                          isAdded
                            ? 'bg-brand-success/20 text-brand-success'
                            : 'bg-brand-blue/15 text-brand-blue hover:bg-brand-blue/25 border border-brand-blue/30'
                        }`}
                      >
                        {isAdded ? <><CheckSquare size={12} /> Added</> : <><Plus size={12} /> Add to Account</>}
                      </button>
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && <p className="text-text-dim text-sm">No relevant events found</p>}
            </div>
          </div>

          {/* Slack */}
          <div className="card">
            <h3 className="text-h5 font-semibold mb-3 flex items-center gap-2"><MessageSquare size={18} className="text-purple-400" /> Slack ({slackChannels.length})</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {slackChannels.map((ch, i) => {
                const isAdded = addedSlack.has(ch.name);
                return (
                  <div key={i} className="p-3 rounded-lg bg-brand-bg border border-brand-border/30 hover:border-brand-border transition-colors">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-primary font-medium">#{ch.name}</p>
                      {ch.permalink && (
                        <a href={ch.permalink} target="_blank" rel="noopener" className="text-brand-blue">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {ch.purpose && <p className="text-caption text-text-muted mt-0.5">{ch.purpose}</p>}
                    <p className="text-caption text-text-dim mt-0.5">{ch.type}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => addSlackToAccount(ch)}
                        disabled={isAdded}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                          isAdded
                            ? 'bg-brand-success/20 text-brand-success'
                            : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30'
                        }`}
                      >
                        {isAdded ? <><CheckSquare size={12} /> Added</> : <><Plus size={12} /> Add to Account</>}
                      </button>
                    </div>
                  </div>
                );
              })}
              {slackChannels.length === 0 && <p className="text-text-dim text-sm">No Slack channels found</p>}
            </div>
          </div>
        </div>
      )}

      {!scanResults && !scanning && (
        <div className="text-center py-16 text-text-muted">
          <ScanLine size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Click "Scan Now" to analyze your emails, calendar, and Slack</p>
          <p className="text-sm mt-1">Tasks will be suggested based on onboarding calls, follow-ups, budget alerts, and action items</p>
        </div>
      )}
    </div>
  );
}

function extractAccountFromSubject(subject) {
  const m = subject.match(/Account:\s*(.+?)(?:\s*\(|$)/);
  return m ? m[1].trim() : '';
}

function extractAccountFromBody(body) {
  const m = body.match(/Account:\s*(.+?)(?:\s*\(|\s*Campaign)/);
  return m ? m[1].trim() : '';
}
