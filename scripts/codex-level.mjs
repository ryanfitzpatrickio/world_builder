#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createLevelPlan, resolveLevelOptions } from '../src/agent/LevelPlanner.js';

function parseArgs(argv) {
  const options = {
    preset: 'saloon',
    stories: 2,
    style: 'western',
    output: 'public/levels/codex-level.json',
    name: '',
    brief: '',
    print: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--print') options.print = true;
    else if (arg === '--preset') options.preset = argv[++i] || options.preset;
    else if (arg === '--stories') options.stories = Number(argv[++i] || options.stories);
    else if (arg === '--style') options.style = argv[++i] || options.style;
    else if (arg === '--output' || arg === '-o') options.output = argv[++i] || options.output;
    else if (arg === '--name') options.name = argv[++i] || options.name;
    else if (arg === '--brief') options.brief = argv[++i] || options.brief;
    else if (!arg.startsWith('-')) options.brief = [options.brief, arg].filter(Boolean).join(' ');
  }

  return {
    ...options,
    ...resolveLevelOptions(options),
  };
}

function printHelp() {
  console.log(`Usage:
  npm run codex:level -- --brief "two story saloon" --output public/levels/two-story-saloon.json
  npm run codex:level -- --preset boarding-house --stories 3 --print

Options:
  --brief <text>      Short natural-language layout hint.
  --preset <name>     saloon, boarding-house, or jail.
  --stories <n>       1 to 4 grid floors.
  --style <name>      Tile style, defaults to western.
  --output, -o <path> JSON level path.
  --print             Also print the JSON to stdout.
`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const level = createLevelPlan(options);
const outputPath = resolve(options.output || 'public/levels/codex-level.json');
const json = `${JSON.stringify(level, null, 2)}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, json, 'utf8');
if (options.print) process.stdout.write(json);
else console.log(`Wrote ${outputPath} (${level.shapes.length} shapes)`);
