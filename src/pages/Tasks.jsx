import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Plus, Filter, Trash2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, timeAgo } from '../utils/helpers';

export default function Tasks() {
  const { state, dispatch } = useApp();
  const [newTask, setNewTask] = useState('');
  const [newAccount, setNewAccount] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [filter, setFilter] = useState('active');
  const [accountFilter, setAccountFilter] = useState('all');

  const accounts = useMemo(() => {
    const names = new Set(state.tasks.map(t => t.account).filter(Boolean));
    return Array.from(names).sort();
  }, [state.tasks]);

  const filtered = useMemo(() => {
    let tasks = state.tasks;
    if (filter === 'active') tasks = tasks.filter(t => !t.completed);
    else if (filter === 'completed') tasks = tasks.filter(t => t.completed);
    if (accountFilter !== 'all') tasks = tasks.filter(t => t.account === accountFilter);
    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
  }, [state.tasks, filter, accountFilter]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    dispatch({
      type: 'ADD_TASK',
      payload: { title: newTask.trim(), account: newAccount || '', priority: newPriority, completed: false }
    });
    setNewTask('');
    setNewAccount('');
  };

  const priorityColors = { high: 'badge-red', medium: 'badge-orange', low: 'badge-green' };
  const stats = {
    total: state.tasks.length,
    active: state.tasks.filter(t => !t.completed).length,
    completed: state.tasks.filter(t => t.completed).length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-h3 font-bold">Tasks</h1>
        <p className="text-text-muted text-sm mt-1">Manage tasks across all your accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-text-primary">{stats.active}</p>
          <p className="text-caption text-text-muted">Active</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-success">{stats.completed}</p>
          <p className="text-caption text-text-muted">Completed</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-text-muted">{stats.total}</p>
          <p className="text-caption text-text-muted">Total</p>
        </div>
      </div>

      {/* Add Task */}
      <form onSubmit={handleAdd} className="card">
        <h3 className="text-h5 font-semibold mb-3">Add Task</h3>
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Task description..." value={newTask} onChange={e => setNewTask(e.target.value)} className="input flex-1 min-w-[200px]" />
          <input type="text" placeholder="Account name (optional)" value={newAccount} onChange={e => setNewAccount(e.target.value)} className="input w-48" list="account-names" />
          <datalist id="account-names">
            {state.accounts.map(a => <option key={a.name} value={a.name} />)}
          </datalist>
          <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="input w-32">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="btn-primary flex items-center gap-1"><Plus size={16} /> Add</button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex gap-1 border border-brand-border rounded-lg p-0.5">
          {['active', 'completed', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded text-sm capitalize ${filter === f ? 'bg-brand-elevated text-text-primary' : 'text-text-muted'}`}>{f}</button>
          ))}
        </div>
        <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="input">
          <option value="all">All Accounts</option>
          {accounts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p>No tasks to show</p>
          </div>
        )}
        {filtered.map(task => (
          <div key={task.id} className="card flex items-center gap-3 py-3">
            <button
              onClick={() => dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, completed: !task.completed } })}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                task.completed ? 'bg-brand-success border-brand-success' : 'border-brand-border hover:border-brand-blue'
              }`}
            >
              {task.completed && <span className="text-white text-xs">✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.completed ? 'line-through text-text-dim' : 'text-text-primary'}`}>{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {task.account && (
                  <Link to={`/accounts/${encodeURIComponent(task.account)}`} className="text-caption text-brand-blue hover:underline">{task.account}</Link>
                )}
                <span className="text-caption text-text-dim flex items-center gap-1"><Clock size={10} /> {timeAgo(task.createdAt)}</span>
              </div>
            </div>
            <span className={`badge ${priorityColors[task.priority] || 'badge-gray'} flex-shrink-0`}>{task.priority}</span>
            <button onClick={() => dispatch({ type: 'DELETE_TASK', payload: task.id })} className="text-text-dim hover:text-brand-error transition-colors flex-shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
