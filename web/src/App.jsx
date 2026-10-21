import { useCallback, useEffect, useState } from 'react';
import { api, setToken, setUnauthorizedHandler } from './api.js';
import NewProposal from './NewProposal.jsx';
import JobView from './JobView.jsx';
import CompanyProfileModal from './CompanyProfileModal.jsx';

function parseHash() {
  const m = /^#\/job\/([a-f0-9-]{36})$/.exec(window.location.hash);
  return m ? { name: 'job', id: m[1] } : { name: 'new' };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((target) => {
    window.location.hash = target.name === 'job' ? `#/job/${target.id}` : '#/';
  }, []);
  return [route, go];
}

function TokenGate({ onSubmit, rejected }) {
  const [value, setValue] = useState('');
  return (
    <div className="gate">
      <form
        className="card gate-card"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value.trim());
        }}
      >
        <h1>Proposal Strategist</h1>
        <p className="muted">Enter the team access token to continue.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Access token"
          aria-label="Access token"
        />
        {rejected && <p className="error-text">That token was not accepted.</p>}
        <button className="btn primary" disabled={!value.trim()}>
          Continue
        </button>
      </form>
    </div>
  );
}

const STATUS_LABEL = { queued: 'Queued', running: 'Running', done: 'Done', error: 'Failed' };

function formatDate(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [route, go] = useRoute();
  const [jobs, setJobs] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    setUnauthorizedHandler(() => setNeedsToken(true));
    api
      .config()
      .then((c) => {
        setConfig(c);
        if (c.requiresToken) setNeedsToken(true);
      })
      .catch((e) => setConfigError(e.message));
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      setJobs(await api.listJobs());
    } catch {
      /* the gate or the page-level error handles it */
    }
  }, []);

  // Validate any stored token by trying to load the list.
  useEffect(() => {
    if (!config) return;
    if (!config.requiresToken) {
      setNeedsToken(false);
      return;
    }
    api
      .listJobs()
      .then((list) => {
        setJobs(list);
        setNeedsToken(false);
      })
      .catch(() => setNeedsToken(true));
  }, [config]);

  useEffect(() => {
    if (!config || needsToken) return undefined;
    refreshJobs();
    const t = setInterval(refreshJobs, 4000);
    return () => clearInterval(t);
  }, [config, needsToken, refreshJobs]);

  if (configError) {
    return (
      <div className="gate">
        <div className="card gate-card">
          <h1>Proposal Strategist</h1>
          <p className="error-text">{configError}</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!config) return <div className="gate muted">Loading…</div>;

  if (needsToken) {
    return (
      <TokenGate
        rejected={tokenRejected}
        onSubmit={async (value) => {
          setToken(value);
          try {
            setJobs(await api.listJobs());
            setTokenRejected(false);
            setNeedsToken(false);
          } catch {
            setTokenRejected(true);
            setNeedsToken(true);
          }
        }}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🏹</span>
          <div>
            <div className="brand-name">Proposal Strategist</div>
            <div className="brand-sub">RFP to win strategy</div>
          </div>
        </div>

        <button className="btn primary block" onClick={() => go({ name: 'new' })}>
          + New proposal
        </button>

        <nav className="history" aria-label="Past proposals">
          <div className="section-label">Recent</div>
          {jobs.length === 0 && <p className="muted small">Nothing yet. Upload an RFP to start.</p>}
          {jobs.map((j) => (
            <button
              key={j.id}
              className={`history-item ${route.name === 'job' && route.id === j.id ? 'active' : ''}`}
              onClick={() => go({ name: 'job', id: j.id })}
            >
              <span className={`dot ${j.status}`} title={STATUS_LABEL[j.status]} />
              <span className="history-text">
                <span className="history-buyer">{j.buyer}</span>
                <span className="history-meta">
                  {j.status === 'running' || j.status === 'queued'
                    ? `Step ${Math.min(j.progress + 1, j.total)} of ${j.total}`
                    : formatDate(j.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <button className="btn ghost block" onClick={() => setProfileOpen(true)}>
          Company profile
        </button>
      </aside>

      <main className="main">
        {config.mock && (
          <div className="banner">Demo mode: the agent returns placeholder text instead of calling the AI.</div>
        )}
        {route.name === 'job' ? (
          <JobView key={route.id} id={route.id} onNew={() => go({ name: 'new' })} />
        ) : (
          <NewProposal
            config={config}
            profileVersion={profileVersion}
            onOpenProfile={() => setProfileOpen(true)}
            onCreated={(id) => {
              refreshJobs();
              go({ name: 'job', id });
            }}
          />
        )}
      </main>

      {profileOpen && (
        <CompanyProfileModal
          onClose={() => setProfileOpen(false)}
          onSaved={() => setProfileVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
