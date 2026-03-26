#!/usr/bin/env node
/**
 * spec-kit.js — token-efficient project analyzer
 *
 * Token reduction strategies applied:
 *  1. Strip single-line comments from JS/TS files
 *  2. Collapse consecutive blank lines to one
 *  3. Truncate files that are still large after compression
 *  4. Skip low-value file types (CSS, HTML, test files, config boilerplate)
 *  5. Use prompt caching on the system prompt (cache_control)
 *  6. Compact system prompt — no padding, no repetition
 *
 * Usage:
 *   node backend/spec-kit.js
 *   node backend/spec-kit.js --output spec.md
 *   node backend/spec-kit.js --focus auth
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', '.next', 'dist', 'build',
  'coverage', '.nyc_output', '.cache', 'public', '.agents', '.cursor',
  '.claude', 'memory', 'ffmpeg',
]);

// Only include high-signal file types
const INCLUDE_EXTS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.sql', '.json',
]);

// Include these specific filenames regardless of extension
const INCLUDE_NAMES = new Set([
  '.env.example', 'README.md', 'QUICKSTART.md',
]);

// Skip these filenames
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db', 'next-env.d.ts',
]);

// Skip files whose path includes these fragments (test / boilerplate / generated)
const SKIP_PATH_FRAGMENTS = [
  '.test.', '.spec.', '__tests__', '__mocks__',
  'tailwind.config', 'postcss.config',
  'copy-ffmpeg', 'ffmpeg-core',
  'globals.css',
];

/** Max chars per file AFTER compression before we truncate */
const MAX_CHARS = 6_000;

/** Max chars of a truncated file to show */
const TRUNCATE_TO = 3_000;

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const getArg     = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const outputFile = getArg('--output');
const focusTerm  = getArg('--focus') || '';

// ─── Token-reduction helpers ──────────────────────────────────────────────────

/** Remove single-line // comments and collapse blank lines */
function compressCode(src) {
  return src
    .split('\n')
    .map(line => {
      // strip trailing // comment (but keep URLs like https://)
      return line.replace(/\s+\/\/(?!\/|https?:).*$/, '');
    })
    .filter((line, i, arr) => {
      // collapse consecutive blank lines to one
      if (line.trim() === '' && arr[i - 1] && arr[i - 1].trim() === '') return false;
      return true;
    })
    .join('\n')
    .trim();
}

/** Compress SQL: strip -- comments, collapse blanks */
function compressSQL(src) {
  return src
    .split('\n')
    .map(line => line.replace(/--.*$/, '').trimEnd())
    .filter((line, i, arr) => {
      if (line.trim() === '' && arr[i - 1] && arr[i - 1].trim() === '') return false;
      return true;
    })
    .join('\n')
    .trim();
}

/** Compress JSON: strip whitespace (minify) */
function compressJSON(src) {
  try { return JSON.stringify(JSON.parse(src)); }
  catch { return src.trim(); }
}

/** Apply the right compressor for a file extension */
function compress(src, ext) {
  if (ext === '.sql') return compressSQL(src);
  if (ext === '.json') return compressJSON(src);
  if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) return compressCode(src);
  return src.trim();
}

/** Truncate with a marker if still too long */
function truncate(text, filePath) {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, TRUNCATE_TO)
    + `\n\n... [TRUNCATED — ${Math.round((text.length - TRUNCATE_TO) / 1000)}KB omitted from ${filePath}]`;
}

// ─── File walker ──────────────────────────────────────────────────────────────

function walkDir(dir, rel = '') {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) results.push(...walkDir(absPath, relPath));
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (SKIP_PATH_FRAGMENTS.some(frag => relPath.includes(frag))) continue;

      const ext  = path.extname(entry.name).toLowerCase();
      const name = entry.name;

      if (!INCLUDE_EXTS.has(ext) && !INCLUDE_NAMES.has(name)) continue;

      try {
        const { size } = fs.statSync(absPath);
        results.push({ rel: relPath, abs: absPath, size, ext });
      } catch { /* skip */ }
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌  ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });

  const files = walkDir(PROJECT_ROOT);
  console.error(`📁 Project root : ${PROJECT_ROOT}`);
  console.error(`📄 Files found  : ${files.length}`);

  // Compress + truncate each file, build content block
  let totalRaw = 0, totalCompressed = 0;

  const fileContent = files.map(({ rel, abs, ext }) => {
    let src;
    try { src = fs.readFileSync(abs, 'utf8'); }
    catch { return `// FILE: ${rel}\n(unreadable)`; }

    totalRaw += src.length;
    const compressed = truncate(compress(src, ext), rel);
    totalCompressed += compressed.length;

    return `// FILE: ${rel}\n${compressed}`;
  }).join('\n\n---\n\n');

  const saved = Math.round((1 - totalCompressed / totalRaw) * 100);
  console.error(`✂️  Compression : ${fmtKB(totalRaw)} → ${fmtKB(totalCompressed)} (${saved}% smaller)\n`);

  const focusClause = focusTerm ? `Focus especially on "${focusTerm}". ` : '';

  // Compact system prompt — fewer tokens, same instructions
  const systemPrompt =
`You are a senior software architect. ${focusClause}Write a concise Markdown spec for "ProScreen" (screen-recording SaaS) covering:
1. Project overview & tech stack
2. Architecture diagram (Mermaid or ASCII)
3. Directory structure (annotated)
4. Backend: routes, middleware, services, JWT auth flow
5. Frontend: Next.js pages, hooks, API client
6. Database schema & migrations
7. Auth & authorization (plans, features, quotas, audit log)
8. Subscription/pricing system & credits
9. Claude SDK integration points
10. Required .env variables
11. TODOs / gaps
12. Recommended next steps`;

  const userMessage =
`Project files (${files.length} files, compressed):\n\n${fileContent}\n\nWrite the spec now.`;

  console.error('🤖 Streaming from Claude Opus 4.6...\n');
  console.error('─'.repeat(70));

  const out = outputFile
    ? fs.createWriteStream(outputFile, { flags: 'w' })
    : process.stdout;

  if (outputFile) console.error(`📝 Writing to: ${outputFile}\n`);

  // Use cache_control on system prompt to save tokens on repeated runs
  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  let thinkingShown = false;
  for await (const event of stream) {
    if (event.type === 'content_block_start'
        && event.content_block.type === 'thinking'
        && !thinkingShown) {
      process.stderr.write('💭 [Claude is thinking...]\n\n');
      thinkingShown = true;
    }
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      out.write(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  out.write('\n');
  if (outputFile) out.end();

  console.error('\n' + '─'.repeat(70));
  console.error('\n✅  Done!');
  console.error(`   Input tokens  : ${final.usage.input_tokens.toLocaleString()}`);
  console.error(`   Output tokens : ${final.usage.output_tokens.toLocaleString()}`);
  if (final.usage.cache_creation_input_tokens)
    console.error(`   Cache created : ${final.usage.cache_creation_input_tokens.toLocaleString()} tokens`);
  if (final.usage.cache_read_input_tokens)
    console.error(`   Cache hit     : ${final.usage.cache_read_input_tokens.toLocaleString()} tokens saved`);
  if (outputFile) console.error(`   Spec written  : ${outputFile}`);
}

function fmtKB(n) {
  return n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`;
}

main().catch((err) => {
  console.error('\n❌  Fatal error:', err.message || err);
  process.exit(1);
});
