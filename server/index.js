import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_MODEL, buildSteps, runPipeline, combineMarkdown, slugify } from '../core/pipeline.js';
import { extractText, ExtractionError, ALLOWED_EXTENSIONS } from './extract.js';
import { initStore, saveJob, getJob, listJobs, getCompanyProfile, saveCompanyProfile } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.MODEL || DEFAULT_MODEL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const MOCK = process.env.MOCK_AI === '1';

if (!process.env.GEMINI_API_KEY && !MOCK) {
  console.error('GEMINI_API_KEY is not set. Copy .env.example to .env and add your key (or set MOCK_AI=1 to test without one).');
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 2 } });
const app = express();
app.use(express.json({ limit: '2mb' }));

// Optional shared access token. Set ACCESS_TOKEN to require it on every API call.
app.use('/api', (req, res, next) => {
  if (!ACCESS_TOKEN || req.path === '/config') return next();
  const given = req.get('x-access-token') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(ACCESS_TOKEN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Access token required.' });
});

app.get('/api/config', (_req, res) => {
  res.json({ requiresToken: Boolean(ACCESS_TOKEN), model: MODEL, mock: MOCK, allowedExtensions: ALLOWED_EXTENSIONS });
});

// ---- Company profile (saved once, reused for every proposal) ----
app.get('/api/company-profile', async (_req, res) => {
  res.json({ text: await getCompanyProfile() });
});

app.put('/api/company-profile', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : null;
  if (text === null) return res.status(400).json({ error: 'Body must be { "text": "..." }.' });
  if (text.length > 100_000) return res.status(400).json({ error: 'Company profile is too long (100,000 character limit).' });
  await saveCompanyProfile(text);
  res.json({ ok: true });
});

// ---- Jobs ----
app.get('/api/jobs', async (_req, res) => {
  res.json(await listJobs());
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Proposal not found.' });
  const { rfpText, companyText, ...publicJob } = job;
  res.json(publicJob);
});

app.get('/api/jobs/:id/download', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Proposal not found.' });
  const steps = job.steps.filter((s) => s.status === 'done');
  if (!steps.length) return res.status(409).json({ error: 'Nothing to download yet.' });
  const results = Object.fromEntries(steps.map((s) => [s.id, s.text]));
  const md = combineMarkdown({ buyer: job.buyer, model: job.model, steps, results });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slugify(job.buyer)}-proposal-strategy.md"`);
  res.send(md);
});

app.post(
  '/api/jobs',
  upload.fields([{ name: 'rfp', maxCount: 1 }, { name: 'company', maxCount: 1 }]),
  async (req, res) => {
    try {
      const buyer = String(req.body.buyer || '').trim();
      if (!buyer) return res.status(400).json({ error: 'Buyer name is required.' });
      if (buyer.length > 200) return res.status(400).json({ error: 'Buyer name is too long.' });

      // RFP: uploaded file, or pasted text.
      let rfpText = '';
      let rfpName = 'Pasted text';
      const warnings = [];
      const rfpFile = req.files?.rfp?.[0];
      if (rfpFile) {
        const { text, truncated } = await extractText(rfpFile);
        rfpText = text;
        rfpName = rfpFile.originalname;
        if (truncated) warnings.push('The RFP was very long and was truncated to its first 200,000 characters.');
      } else if (req.body.rfpText?.trim()) {
        rfpText = req.body.rfpText.trim();
      }
      if (!rfpText) return res.status(400).json({ error: 'Upload an RFP file or paste its text.' });

      // Company profile: one-off upload, else saved profile (unless switched off).
      let companyText = '';
      const companyFile = req.files?.company?.[0];
      if (companyFile) {
        companyText = (await extractText(companyFile)).text;
      } else if (req.body.useSavedProfile !== 'false') {
        companyText = await getCompanyProfile();
      }
      if (!companyText.trim()) {
        warnings.push('No company profile was used, so proof points will appear as [INSERT: ...] placeholders.');
      }

      const stepMeta = buildSteps({ buyer, rfp: '', company: '' }).map((s) => ({
        id: s.id,
        title: s.title,
        status: 'pending',
        text: '',
      }));
      const job = {
        id: crypto.randomUUID(),
        buyer,
        rfpName,
        model: MODEL,
        status: 'queued',
        createdAt: new Date().toISOString(),
        warnings,
        steps: stepMeta,
        error: null,
        rfpText,
        companyText,
      };
      await saveJob(job);
      res.status(202).json({ id: job.id });

      runJob(job).catch((err) => console.error('Unexpected job failure', err));
    } catch (err) {
      if (err instanceof ExtractionError) return res.status(422).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong while starting the proposal.' });
    }
  },
);

async function runJob(job) {
  job.status = 'running';
  await saveJob(job);
  try {
    await runPipeline({
      client,
      model: job.model,
      buyer: job.buyer,
      rfp: job.rfpText,
      company: job.companyText,
      onEvent: (e) => {
        const step = job.steps[e.index];
        if (e.type === 'step-start') step.status = 'running';
        if (e.type === 'step-done') {
          step.status = 'done';
          step.text = e.text;
        }
        saveJob(job).catch(() => {});
      },
    });
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = friendlyError(err);
    const running = job.steps.find((s) => s.status === 'running');
    if (running) running.status = 'error';
    console.error(`Job ${job.id} failed:`, err.message);
  }
  await saveJob(job);
}

function friendlyError(err) {
  const status = err?.status;
  if (status === 401 || err?.message?.includes('API key')) return 'The Gemini API key was rejected. Ask an admin to check GEMINI_API_KEY.';
  if (status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED')) return 'The AI service is rate-limited right now. Try again in a minute.';
  if (status === 529 || status >= 500) return 'The AI service is temporarily unavailable. Try again shortly.';
  return `The agent stopped unexpectedly: ${err?.message || 'unknown error'}`;
}

// Surface multer errors (file too large etc.) as JSON.
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (15 MB limit).' : err.message;
    return res.status(413).json({ error: msg });
  }
  next(err);
});

// Unknown API routes return JSON, not an HTML error page.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built UI in production.
const dist = path.join(__dirname, '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

await initStore();
app.listen(PORT, () => {
  console.log(`Proposal Strategist server on http://localhost:${PORT}${MOCK ? '  (MOCK_AI mode)' : ''}`);
  if (!ACCESS_TOKEN) console.log('Note: ACCESS_TOKEN is not set, so anyone who can reach this server can use it.');
});
