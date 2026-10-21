#!/usr/bin/env node
// Proposal Strategist CLI. The pipeline itself lives in core/pipeline.js
// (shared with the web server).
//
// Usage:
//   node agent.js --rfp rfp.md --buyer "Buyer Name" [--company company.md] [--out ./out] [--model gemini-2.5-flash] [--dry-run]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_MODEL,
  slugify,
  loadSystemPrompt,
  buildSteps,
  runPipeline,
  combineMarkdown,
} from './core/pipeline.js';

const HELP = `Proposal Strategist agent

Usage:
  node agent.js --rfp <file> --buyer "<name>" [options]

Options:
  --rfp <file>       RFP or opportunity brief (.md or .txt)         (required)
  --buyer <name>     Buyer / client name                            (required)
  --company <file>   Your company profile: strengths, past work,
                     metrics, differentiators (strongly recommended)
  --out <dir>        Output directory (default: ./out/<buyer-slug>)
  --model <id>       Model to use (default: ${DEFAULT_MODEL})
  --dry-run          Print the prompts without calling the API
  --help             Show this help

Requires GEMINI_API_KEY in the environment (not needed for --dry-run).
For PDF/Word uploads and a team-friendly interface, use the web app (npm run dev).
`;

function parseCli() {
  try {
    const { values } = parseArgs({
      options: {
        rfp: { type: 'string' },
        buyer: { type: 'string' },
        company: { type: 'string' },
        out: { type: 'string' },
        model: { type: 'string', default: DEFAULT_MODEL },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    });
    return values;
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    console.error(HELP);
    process.exit(1);
  }
}

async function main() {
  const args = parseCli();
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.rfp || !args.buyer) {
    console.error('Error: --rfp and --buyer are required.\n');
    console.error(HELP);
    process.exit(1);
  }
  for (const f of [args.rfp, args.company].filter(Boolean)) {
    if (!existsSync(f)) {
      console.error(`Error: file not found: ${f}`);
      process.exit(1);
    }
  }

  const rfp = await readFile(args.rfp, 'utf8');
  const company = args.company ? await readFile(args.company, 'utf8') : '';
  const outDir = args.out ?? path.join('out', slugify(args.buyer));

  if (args['dry-run']) {
    const system = await loadSystemPrompt();
    const steps = buildSteps({ buyer: args.buyer, rfp, company });
    console.log(`DRY RUN: no API calls.\nModel: ${args.model}\nOutput dir: ${outDir}`);
    console.log(`System prompt: ${system.length} characters\n`);
    const placeholders = Object.fromEntries(steps.map((s) => [s.id, `<output of ${s.id}>`]));
    for (const step of steps) {
      const p = step.prompt(placeholders);
      console.log(`--- ${step.id}: ${step.title} (${p.length} characters) ---`);
      console.log(p.slice(0, 400) + (p.length > 400 ? '\n...[truncated]' : ''));
      console.log();
    }
    return;
  }

  if (!process.env.GEMINI_API_KEY && process.env.MOCK_AI !== '1') {
    console.error('Error: GEMINI_API_KEY is not set.');
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' });
  await mkdir(outDir, { recursive: true });

  let started = Date.now();
  let files = 0;
  const { steps, results } = await runPipeline({
    client,
    model: args.model,
    buyer: args.buyer,
    rfp,
    company,
    onEvent: (e) => {
      if (e.type === 'step-start') {
        process.stdout.write(`[${e.index + 1}/${e.total}] ${e.title}... `);
        started = Date.now();
      } else if (e.type === 'step-done') {
        writeFileSync(path.join(outDir, `${e.id}.md`), e.text + '\n');
        files++;
        console.log(`done (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      }
    },
  }).catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    process.exit(1);
  });

  await writeFile(
    path.join(outDir, 'proposal-strategy.md'),
    combineMarkdown({ buyer: args.buyer, model: args.model, steps, results }),
  );
  console.log(`\nWrote ${files + 1} files to ${outDir}/`);
  console.log(`Start with ${path.join(outDir, 'proposal-strategy.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
