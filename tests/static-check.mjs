import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';import assert from 'node:assert/strict';
const admin=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const student=fs.readFileSync(new URL('../student/index.html',import.meta.url),'utf8');
const pub=fs.readFileSync(new URL('../worker-public/wrangler.toml',import.meta.url),'utf8');
const adm=fs.readFileSync(new URL('../worker-admin/wrangler.toml',import.meta.url),'utf8');
for(const text of [admin,student])assert.match(text,/<!doctype html>/i);
for(const route of ['/api/admin/review','/api/admin/audio/upload','/api/admin/course/publish'])assert.ok(admin.includes(route),`admin missing ${route}`);
for(const route of ['/api/catalog','/api/course/','/media/'])assert.ok(student.includes(route),`student missing ${route}`);
assert.match(pub,/binding\s*=\s*"STATIC"/);assert.match(pub,/run_worker_first\s*=\s*true/);assert.match(pub,/bucket_name\s*=\s*"fluency-engine"/);assert.match(adm,/bucket_name\s*=\s*"fluency-engine"/);
console.log('Static configuration checks passed.');

// Stabilization regression: extract and syntax-check the admin page's inline script.
{
  const match = admin.match(/<script>([\s\S]*)<\/script>/);
  assert(match, 'admin/index.html must contain an inline script');
  const tmp = path.join(os.tmpdir(), `fluency-admin-${process.pid}.js`);
  fs.writeFileSync(tmp, match[1]);
  const checked = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  assert.equal(checked.status, 0, `Admin inline JavaScript syntax failed:\n${checked.stderr}`);
}
