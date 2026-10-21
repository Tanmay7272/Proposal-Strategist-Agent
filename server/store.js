// Tiny file-based store: one JSON file per job, plus the saved company profile.
// Swap this module for MongoDB later without touching the routes.
import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
const PROFILE_PATH = path.join(DATA_DIR, 'company-profile.md');

export async function initStore() {
  await mkdir(JOBS_DIR, { recursive: true });
}

const jobPath = (id) => path.join(JOBS_DIR, `${id}.json`);

// Writes for the same job are queued and atomic (temp file + rename), so a reader
// never sees a half-written file and two updates can't interleave.
const writeQueues = new Map();
export function saveJob(job) {
  const snapshot = JSON.stringify(job, null, 2);
  const prev = writeQueues.get(job.id) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      const tmp = `${jobPath(job.id)}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, jobPath(job.id));
    });
  writeQueues.set(job.id, next);
  next.finally(() => {
    if (writeQueues.get(job.id) === next) writeQueues.delete(job.id);
  });
  return next;
}

export async function getJob(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(jobPath(id), 'utf8'));
  } catch {
    return null;
  }
}

// Summaries for the history list (no step text, no source documents).
export async function listJobs() {
  const files = (await readdir(JOBS_DIR)).filter((f) => f.endsWith('.json'));
  const jobs = await Promise.all(
    files.map(async (f) => {
      try {
        const j = JSON.parse(await readFile(path.join(JOBS_DIR, f), 'utf8'));
        return {
          id: j.id,
          buyer: j.buyer,
          rfpName: j.rfpName,
          status: j.status,
          createdAt: j.createdAt,
          progress: j.steps.filter((s) => s.status === 'done').length,
          total: j.steps.length,
        };
      } catch {
        return null;
      }
    }),
  );
  return jobs.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCompanyProfile() {
  try {
    return await readFile(PROFILE_PATH, 'utf8');
  } catch {
    return '';
  }
}

export async function saveCompanyProfile(text) {
  await writeFile(PROFILE_PATH, text);
}
