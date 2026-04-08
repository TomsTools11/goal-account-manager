import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext();

const initialState = {
  accounts: [],
  notionAccounts: [],
  localAccounts: [],
  tasks: JSON.parse(localStorage.getItem('gam_tasks') || '[]'),
  loading: {},
  errors: {},
  searchResults: null,
  selectedAccount: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.key]: action.value } };
    case 'SET_NOTION_ACCOUNTS':
      return { ...state, notionAccounts: action.payload };
    case 'SET_LOCAL_ACCOUNTS':
      return { ...state, localAccounts: action.payload };
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload };
    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter(a => a.name.toLowerCase() !== action.payload.toLowerCase()),
      };
    case 'SET_SELECTED_ACCOUNT':
      return { ...state, selectedAccount: action.payload };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    case 'ADD_TASK':
      const newTasks = [...state.tasks, { ...action.payload, id: Date.now(), createdAt: new Date().toISOString() }];
      localStorage.setItem('gam_tasks', JSON.stringify(newTasks));
      return { ...state, tasks: newTasks };
    case 'UPDATE_TASK':
      const updatedTasks = state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t);
      localStorage.setItem('gam_tasks', JSON.stringify(updatedTasks));
      return { ...state, tasks: updatedTasks };
    case 'DELETE_TASK':
      const filteredTasks = state.tasks.filter(t => t.id !== action.payload);
      localStorage.setItem('gam_tasks', JSON.stringify(filteredTasks));
      return { ...state, tasks: filteredTasks };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const api = useCallback(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, []);

  const apiPost = useCallback(async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, []);

  const apiDelete = useCallback(async (url) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, []);

  const value = { state, dispatch, api, apiPost, apiDelete };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
