import { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api.js';

// Highlights [INSERT: ...] placeholders so the team can see what evidence is still missing.
function remarkPlaceholders() {
  const walk = (node) => {
    if (!node.children) return;
    const out = [];
    for (const child of node.children) {
      if (child.type === 'text') {
        const re = /\[INSERT:[^\]]*\]/g;
        let last = 0;
        let m;
        let split = false;
        while ((m = re.exec(child.value))) {
          split = true;
          if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
          out.push({
            type: 'strong',
            data: { hName: 'mark', hProperties: { className: 'ph' } },
            children: [{ type: 'text', value: m[0] }],
          });
          last = m.index + m[0].length;
        }
        if (!split) out.push(child);
        else if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
      } else {
        walk(child);
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree) => walk(tree);
}

const PLUGINS = [remarkGfm, remarkPlaceholders];
const DEFAULT_TAB = '03-executive-summary';
const SHORT_TITLE = {
  '01-opportunity-analysis': 'Analysis',
  '02-win-theme-matrix': 'Win themes',
  '03-executive-summary': 'Executive summary',
  '04-proposal-architecture': 'Architecture',
  '05-red-team-review': 'Red-team review',
};

function countPlaceholders(steps) {
  return steps.reduce((n, s) => n + (s.text.match(/\[INSERT:[^\]]*\]/g) || []).length, 0);
}

function StatusIcon({ status }) {
  if (status === 'done') return <span className="step-icon done" aria-label="Done">✓</span>;
  if (status === 'running') return <span className="step-icon spin" aria-label="Running" />;
  if (status === 'error') return <span className="step-icon fail" aria-label="Failed">!</span>;
  return <span className="step-icon pending" aria-label="Waiting" />;
}

export default function JobView({ id, onNew }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer;
    async function load() {
      try {
        const j = await api.getJob(id);
        if (stopped) return;
        setJob(j);
        setError('');
        if (j.status === 'queued' || j.status === 'running') timer = setTimeout(load, 2000);
      } catch (e) {
        if (stopped) return;
        setError(e.message);
        if (e.status !== 404 && e.status !== 401) timer = setTimeout(load, 4000);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  const doneSteps = useMemo(() => (job ? job.steps.filter((s) => s.status === 'done') : []), [job]);
  const placeholders = useMemo(() => (job ? countPlaceholders(doneSteps) : 0), [job, doneSteps]);

  if (!job) {
    return (
      <div className="page">
        {error ? (
          <div className="card">
            <p className="error-text">{error}</p>
            <button className="btn" onClick={onNew}>
              Start a new proposal
            </button>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
  }

  const active =
    (chosen && doneSteps.find((s) => s.id === chosen)) ||
    doneSteps.find((s) => s.id === DEFAULT_TAB) ||
    doneSteps[doneSteps.length - 1] ||
    null;
  const current = job.steps.find((s) => s.status === 'running');
  const inProgress = job.status === 'queued' || job.status === 'running';

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy was blocked by the browser. Select the text and copy it manually.');
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await api.downloadJob(job.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="page wide">
      <header className="page-head row">
        <div>
          <h1>{job.buyer}</h1>
          <p className="muted small">
            {job.rfpName} · started {new Date(job.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="head-actions">
          {placeholders > 0 && (
            <span className="chip warn" title="Evidence the team still needs to supply before sending">
              {placeholders} placeholder{placeholders === 1 ? '' : 's'} to fill
            </span>
          )}
          <button className="btn" onClick={download} disabled={doneSteps.length === 0 || downloading}>
            {downloading ? 'Preparing…' : 'Download all (.md)'}
          </button>
        </div>
      </header>

      {job.warnings?.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}

      {job.status === 'error' && (
        <div className="card error-card" role="alert">
          <strong>This proposal stopped before finishing.</strong>
          <p>{job.error}</p>
          <button className="btn" onClick={onNew}>
            Start a new proposal
          </button>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Agent outputs">
        {job.steps.map((s, i) => {
          const ready = s.status === 'done';
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active?.id === s.id}
              className={`tab ${active?.id === s.id ? 'on' : ''}`}
              disabled={!ready}
              onClick={() => setChosen(s.id)}
            >
              <StatusIcon status={s.status} />
              <span>
                <span className="tab-num">{i + 1}</span> {SHORT_TITLE[s.id] || s.title}
              </span>
            </button>
          );
        })}
      </div>

      {inProgress && (
        <p className="progress-note" aria-live="polite">
          {current
            ? `Working on step ${job.steps.indexOf(current) + 1} of ${job.steps.length}: ${current.title}. Each step takes about a minute, and results appear as they finish.`
            : 'Starting…'}
        </p>
      )}

      {active ? (
        <article className="card doc">
          <div className="doc-bar">
            <span className="muted small">{active.title}</span>
            <button className="btn ghost small" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="markdown">
            <Markdown remarkPlugins={PLUGINS}>{active.text}</Markdown>
          </div>
        </article>
      ) : (
        !inProgress && <p className="muted">No output was produced.</p>
      )}

      {job.status === 'done' && (
        <p className="muted small footnote">
          Treat this as a strategic first draft. Highlighted placeholders mark evidence a person must supply before the
          proposal goes out.
        </p>
      )}
    </div>
  );
}
