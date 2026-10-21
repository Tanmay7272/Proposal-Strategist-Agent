import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const MAX_BYTES = 15 * 1024 * 1024;

function checkFile(file, allowed) {
  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!allowed.includes(ext)) return `"${file.name}" is not supported. Use ${allowed.join(', ')}.`;
  if (file.size > MAX_BYTES) return `"${file.name}" is larger than 15 MB.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return '';
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileDrop({ file, onFile, allowed, prompt }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const accept = (f) => {
    if (f) onFile(f);
  };

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={allowed.join(',')}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="file-chip">
          <span className="file-icon" aria-hidden="true">📄</span>
          <span className="file-name">{file.name}</span>
          <span className="muted small">{formatSize(file.size)}</span>
          <button type="button" className="btn ghost small" onClick={() => onFile(null)}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="drop-prompt" onClick={() => inputRef.current?.click()}>
          <strong>{prompt}</strong>
          <span className="muted small">
            Drag a file here or click to browse · {allowed.join(' ')} · up to 15 MB
          </span>
        </button>
      )}
    </div>
  );
}

export default function NewProposal({ config, profileVersion, onOpenProfile, onCreated }) {
  const allowed = config.allowedExtensions;
  const [buyer, setBuyer] = useState('');
  const [rfpMode, setRfpMode] = useState('file'); // file | text
  const [rfpFile, setRfpFile] = useState(null);
  const [rfpText, setRfpText] = useState('');
  const [companyMode, setCompanyMode] = useState('saved'); // saved | upload | none
  const [companyFile, setCompanyFile] = useState(null);
  const [hasProfile, setHasProfile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => setHasProfile(p.text.trim().length > 0))
      .catch(() => setHasProfile(null));
  }, [profileVersion]);

  const pickFile = (setter) => (file) => {
    if (!file) return setter(null);
    const problem = checkFile(file, allowed);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setter(file);
  };

  const rfpReady = rfpMode === 'file' ? Boolean(rfpFile) : rfpText.trim().length >= 50;
  const companyReady = companyMode !== 'upload' || Boolean(companyFile);
  const canSubmit = buyer.trim() && rfpReady && companyReady && !submitting;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    const form = new FormData();
    form.append('buyer', buyer.trim());
    if (rfpMode === 'file') form.append('rfp', rfpFile);
    else form.append('rfpText', rfpText);
    if (companyMode === 'upload') form.append('company', companyFile);
    form.append('useSavedProfile', companyMode === 'saved' ? 'true' : 'false');
    try {
      const { id } = await api.createJob(form);
      onCreated(id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <header className="page-head">
        <h1>New proposal</h1>
        <p className="muted">
          Upload an RFP and the agent will analyse it, build win themes, draft the executive summary, map the proposal
          structure and review its own work. It takes a few minutes.
        </p>
      </header>

      <section className="card field-group">
        <label className="label" htmlFor="buyer">
          Buyer name
        </label>
        <input
          id="buyer"
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          placeholder="e.g. Metro Logistics Authority"
          maxLength={200}
          autoFocus
        />
      </section>

      <section className="card field-group">
        <div className="label-row">
          <span className="label">RFP or opportunity brief</span>
          <div className="seg" role="tablist" aria-label="RFP input method">
            <button type="button" className={rfpMode === 'file' ? 'on' : ''} onClick={() => setRfpMode('file')}>
              Upload file
            </button>
            <button type="button" className={rfpMode === 'text' ? 'on' : ''} onClick={() => setRfpMode('text')}>
              Paste text
            </button>
          </div>
        </div>
        {rfpMode === 'file' ? (
          <FileDrop file={rfpFile} onFile={pickFile(setRfpFile)} allowed={allowed} prompt="Choose the RFP document" />
        ) : (
          <>
            <textarea
              rows={10}
              value={rfpText}
              onChange={(e) => setRfpText(e.target.value)}
              placeholder="Paste the full RFP text here"
            />
            <p className="muted small">{rfpText.trim().length < 50 ? 'Paste at least a few sentences.' : `${rfpText.length.toLocaleString()} characters`}</p>
          </>
        )}
        <p className="muted small">Scanned PDFs without selectable text can't be read. Paste the text instead.</p>
      </section>

      <section className="card field-group">
        <div className="label-row">
          <span className="label">Your company profile</span>
          <button type="button" className="link" onClick={onOpenProfile}>
            {hasProfile ? 'View or edit saved profile' : 'Set up saved profile'}
          </button>
        </div>
        <div className="radio-list">
          <label className="radio">
            <input type="radio" name="company" checked={companyMode === 'saved'} onChange={() => setCompanyMode('saved')} />
            <span>
              <strong>Use the saved company profile</strong>
              <span className="muted small block-text">
                Real case studies and metrics the agent is allowed to cite.
              </span>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="company" checked={companyMode === 'upload'} onChange={() => setCompanyMode('upload')} />
            <span>
              <strong>Upload a different profile for this proposal</strong>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="company" checked={companyMode === 'none'} onChange={() => setCompanyMode('none')} />
            <span>
              <strong>No profile</strong>
              <span className="muted small block-text">Proof points will be marked as placeholders to fill in.</span>
            </span>
          </label>
        </div>
        {companyMode === 'saved' && hasProfile === false && (
          <p className="notice">
            No saved profile yet, so proof points will be placeholders.{' '}
            <button type="button" className="link" onClick={onOpenProfile}>
              Add your profile
            </button>
          </p>
        )}
        {companyMode === 'upload' && (
          <FileDrop file={companyFile} onFile={pickFile(setCompanyFile)} allowed={allowed} prompt="Choose a company profile" />
        )}
      </section>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button className="btn primary large" disabled={!canSubmit}>
          {submitting ? 'Uploading…' : 'Build win strategy'}
        </button>
      </div>
    </form>
  );
}
