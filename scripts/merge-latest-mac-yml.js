#!/usr/bin/env node
/**
 * @deprecated Use merge-latest-yml.js — kept for release scripts compatibility.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, 'merge-latest-yml.js'), ...process.argv.slice(2)],
  { stdio: 'inherit' }
);
process.exit(result.status === null ? 1 : result.status);
