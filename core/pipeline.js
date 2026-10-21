// Shared pipeline used by both the CLI (agent.js) and the web server.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proposal';

export async function loadSystemPrompt() {
  const raw = await readFile(path.join(__dirname, '..', 'prompts', 'system.md'), 'utf8');
  // Strip the YAML frontmatter; the body is the agent's system prompt.
  return raw.replace(/^---[\s\S]*?---\s*/, '').trim();
}

// Each step: what to produce, given the context gathered so far.
export function buildSteps({ buyer, rfp, company }) {
  const context = [
    `# Buyer\n${buyer}`,
    `# RFP / Opportunity Brief\n${rfp}`,
    company
      ? `# Our Company Profile (the only source of evidence you may cite)\n${company}`
      : `# Our Company Profile\nNone provided. Do not invent any evidence. Use [INSERT: ...] placeholders for every proof point, metric, and case study.`,
  ].join('\n\n');

  return [
    {
      id: '01-opportunity-analysis',
      title: 'Opportunity analysis',
      prompt: () => `${context}

Perform Step 1 of your workflow: Opportunity Analysis.

Produce a markdown document with these sections:
1. **Explicit requirements**: a numbered list of every requirement and deliverable in the RFP.
2. **Evaluation criteria and weighting**: stated criteria, plus your read of what the buyer actually cares about.
3. **Implicit preferences and buyer language**: phrases, priorities, and constraints the buyer keeps returning to. Quote key phrases verbatim from the RFP so they can be mirrored later.
4. **Buyer situation**: the central challenge, the cost of inaction, and the stakeholders and politics you can infer. Label inferences as inferences.
5. **Likely competitors and their probable positioning**: by type if names are unknown (incumbent, large integrator, low-cost bidder).
6. **Gaps and questions**: what is missing from the RFP or from our company profile that the team should clarify or supply before finalizing.`,
    },
    {
      id: '02-win-theme-matrix',
      title: 'Win theme matrix',
      prompt: (prev) => `${context}

# Opportunity Analysis (from the previous step)
${prev['01-opportunity-analysis']}

Perform Step 2 of your workflow: Win Theme Development.

Draft 5 candidate themes internally, stress-test each one (specific to this buyer? provable? differentiating? hard for a competitor to claim?), then output only the final 3-5 themes using your Win Theme Matrix format, followed by the Competitive Positioning table.

Rules: every theme must name this buyer's specific challenge. Proof points must come from the company profile; otherwise use an [INSERT: ...] placeholder describing exactly what evidence is needed. Do not name or criticize competitors.`,
    },
    {
      id: '03-executive-summary',
      title: 'Executive summary',
      prompt: (prev) => `${context}

# Opportunity Analysis
${prev['01-opportunity-analysis']}

# Win Theme Matrix
${prev['02-win-theme-matrix']}

Perform Step 3 of your workflow: write the executive summary.

Follow your five-part structure (mirror, tension, thesis, proof, transformed state). Maximum one page (about 350 words). Use the buyer's own language from the analysis. Win themes must surface naturally. No empty adjectives. Output the executive summary only, preceded by a one-line note listing which win themes appear in it.`,
    },
    {
      id: '04-proposal-architecture',
      title: 'Proposal architecture',
      prompt: (prev) => `${context}

# Opportunity Analysis
${prev['01-opportunity-analysis']}

# Win Theme Matrix
${prev['02-win-theme-matrix']}

# Executive Summary
${prev['03-executive-summary']}

Perform Step 3 of your workflow (Narrative Architecture): produce the Proposal Architecture Blueprint using your format. It must include:
- Narrative Flow across the three acts, mapped to the RFP's required sections
- Win Theme Integration Map covering every required section, including pricing
- Compliance Checklist + Strategic Overlay covering every explicit requirement from the analysis
- A short list of where micro-stories and case studies should be embedded, and what evidence the team must gather for each
- A pricing narrative outline: value case first, number last`,
    },
    {
      id: '05-red-team-review',
      title: 'Red-team review',
      prompt: (prev) => `# Package under review
## Win Theme Matrix
${prev['02-win-theme-matrix']}

## Executive Summary
${prev['03-executive-summary']}

## Proposal Architecture
${prev['04-proposal-architecture']}

# Original RFP
${rfp}

Act as a color-team (Red Team) reviewer scoring this package against your own Critical Rules and Success Metrics. Be blunt and specific. Produce:
1. **Scorecard**: pass/fail with one line of evidence for each: buyer-specific (swap test), themes in all key sections, evidence-backed, no empty adjectives, no competitor criticism, full compliance coverage, pricing after value.
2. **Top 5 fixes**, ranked by impact on the evaluation score, each with a concrete rewrite or action.
3. **Evidence to gather**: every [INSERT: ...] placeholder across the package, deduplicated, with an owner suggestion (sales, delivery, finance, legal).`,
    },
  ];
}

// Deterministic stand-in so the whole app can be tested without an API key.
function mockOutput(step) {
  return `# ${step.title} (MOCK OUTPUT)\n\nThis is placeholder text generated because MOCK_AI=1 is set. No API call was made.\n\n- Theme 1: [INSERT: buyer-specific theme]\n- Evidence: [INSERT: metric from similar engagement]\n`;
}

export async function runStep(client, { model, system, step, prev }) {
  if (process.env.MOCK_AI === '1') {
    await new Promise((r) => setTimeout(r, 600));
    return mockOutput(step);
  }
  const response = await client.models.generateContent({
    model,
    contents: step.prompt(prev),
    config: {
      systemInstruction: system,
    },
  });
  return (response.text || '').trim();
}

// Runs every step in order. onEvent receives:
//   { type: 'step-start', index, total, id, title }
//   { type: 'step-done',  index, total, id, title, text }
export async function runPipeline({ client, model = DEFAULT_MODEL, buyer, rfp, company, onEvent = () => {} }) {
  const system = await loadSystemPrompt();
  const steps = buildSteps({ buyer, rfp, company });
  const results = {};
  for (const [index, step] of steps.entries()) {
    const meta = { index, total: steps.length, id: step.id, title: step.title };
    onEvent({ type: 'step-start', ...meta });
    results[step.id] = await runStep(client, { model, system, step, prev: results });
    onEvent({ type: 'step-done', ...meta, text: results[step.id] });
  }
  return { steps, results };
}

export function combineMarkdown({ buyer, model, steps, results }) {
  return [
    `# Proposal Strategy: ${buyer}`,
    `_Generated ${new Date().toISOString().slice(0, 10)} with ${model}_`,
    ...steps.map((s) => `\n---\n\n## ${s.title}\n\n${results[s.id]}`),
  ].join('\n') + '\n';
}
