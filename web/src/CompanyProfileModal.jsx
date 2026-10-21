import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const TEMPLATE = `# Company profile

## What we do
One or two sentences on who we are and who we serve.

## Strengths and differentiators
- Named methods, frameworks, or assets that competitors can't easily claim

## Past performance (real projects only, with measurable results)
1. **Client / project**: what we did and the measurable result. Reference available: yes/no

## Team
- Key people, years of experience, relevant programs they led

## What we can't do or haven't done
- Gaps the agent should not claim to cover
`;

const LIMIT = 100_000;

export default function CompanyProfileModal({ onClose, onSaved }) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => setText(p.text))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.saveProfile(text);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  async function loadFile(file) {
    if (!file) return;
    if (!/\.(md|txt)$/i.test(file.name)) {
      setError('Upload a .md or .txt file here, or paste the text directly.');
      return;
    }
    setError('');
    setText(await file.text());
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="modal-head">
          <h2 id="profile-title">Company profile</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="muted small">
          The agent may only cite evidence written here. Include real projects with metrics and say what you can't do.
          Anything missing becomes a placeholder in the proposal. Saved once, used for every proposal.
        </p>

        <textarea
          rows={16}
          value={text}
          disabled={!loaded}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your company, strengths, past performance and team…"
        />
        <div className="modal-tools">
          <span className={`muted small ${text.length > LIMIT ? 'error-text' : ''}`}>
            {text.length.toLocaleString()} / {LIMIT.toLocaleString()} characters
          </span>
          <span className="tool-buttons">
            {loaded && !text.trim() && (
              <button className="btn ghost small" onClick={() => setText(TEMPLATE)}>
                Insert template
              </button>
            )}
            <input ref={fileRef} type="file" accept=".md,.txt" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button className="btn ghost small" onClick={() => fileRef.current?.click()}>
              Load from file
            </button>
          </span>
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <footer className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving || !loaded || text.length > LIMIT}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </footer>
      </div>
    </div>
  );
}
