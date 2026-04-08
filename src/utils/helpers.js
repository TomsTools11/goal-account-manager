export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function getStatusClass(status) {
  const map = {
    'Incoming': 'status-incoming',
    'Onboarding': 'status-onboarding',
    'Implementation': 'status-implementation',
    'Adoption': 'status-adoption',
    'Expansion': 'status-expansion',
    'Lost': 'status-lost',
  };
  return map[status] || 'badge-gray';
}

export function getTierColor(tier) {
  const map = { 'High': 'badge-red', 'Medium': 'badge-orange', 'Low': 'badge-green' };
  return map[tier] || 'badge-gray';
}

export function getScoreColor(score) {
  const s = parseInt(score);
  if (s >= 4) return 'text-brand-success';
  if (s >= 3) return 'text-brand-blue';
  if (s >= 2) return 'text-brand-warning';
  return 'text-brand-error';
}

export function matchAccountName(name, query) {
  if (!name || !query) return false;
  return name.toLowerCase().includes(query.toLowerCase());
}

export function fileIcon(ext) {
  const icons = {
    '.pdf': 'FileText',
    '.csv': 'Table',
    '.xlsx': 'Table',
    '.xls': 'Table',
    '.md': 'FileText',
    '.html': 'Globe',
    '.htm': 'Globe',
    '.txt': 'FileText',
    '.json': 'Code',
    '.skill': 'Zap',
    '.jpeg': 'Image',
    '.jpg': 'Image',
    '.png': 'Image',
  };
  return icons[ext] || 'File';
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Merge Notion accounts with local file accounts
export function mergeAccounts(notionAccounts, localAccounts) {
  const merged = new Map();

  // Add Notion accounts first
  (notionAccounts || []).forEach(acc => {
    const key = (acc.Name || '').toLowerCase().trim();
    merged.set(key, {
      id: acc.url?.split('/').pop() || key,
      name: acc.Name || 'Unnamed',
      status: acc.Status || 'Incoming',
      tier: acc.Tier || '',
      score: acc['Account Score'] || '',
      mainContact: acc['Main Contact'] || '',
      lastContact: acc['date:Last Contact:start'] || '',
      contractStart: acc['date:Contract Start:start'] || '',
      contactEnd: acc['date:Contact End:start'] || '',
      added: acc.Added || '',
      notionUrl: acc.url || '',
      source: 'notion',
      hasLocalFiles: false,
      localFiles: [],
    });
  });

  // Merge local accounts
  (localAccounts || []).forEach(acc => {
    const key = acc.name.toLowerCase().trim();
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.hasLocalFiles = true;
      existing.localFiles = acc.files || [];
      existing.localPath = acc.path;
      existing.source = 'both';
    } else {
      merged.set(key, {
        id: key.replace(/\s+/g, '-'),
        name: acc.name,
        status: 'Incoming',
        tier: '',
        score: '',
        mainContact: '',
        lastContact: '',
        contractStart: '',
        contactEnd: '',
        added: '',
        notionUrl: '',
        source: 'local',
        hasLocalFiles: true,
        localFiles: acc.files || [],
        localPath: acc.path,
      });
    }
  });

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseEmailSnippet(raw) {
  if (!raw) return { subject: '', from: '', date: '', snippet: '', threadId: '', messageId: '' };
  const lines = typeof raw === 'string' ? raw.split('\n') : [];
  const get = (prefix) => {
    const line = lines.find(l => l.startsWith(prefix));
    return line ? line.replace(prefix, '').trim() : '';
  };
  return {
    subject: get('Subject:'),
    from: get('From:'),
    date: get('Date:'),
    snippet: get('**Snippet**') || lines[lines.length - 1] || '',
    threadId: get('Thread ID:'),
    messageId: get('Message ID:'),
  };
}
