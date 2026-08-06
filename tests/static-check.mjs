import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker-admin/src/index.js',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../worker-admin/wrangler.toml',import.meta.url),'utf8');
assert.match(admin,/<!doctype html>/i);
for(const route of ['/api/admin/review','/api/admin/provider/test','/api/admin/image/status','/api/admin/image/upload','/api/admin/course/readiness','/api/admin/course/publish'])assert.ok(admin.includes(route),`admin missing ${route}`);
assert.match(admin,/Upload image ZIP/);assert.match(admin,/DecompressionStream/);assert.match(admin,/image\/webp/);
assert.match(wrangler,/bucket_name\s*=\s*"fluency-engine"/);
assert.match(worker,/return await reviewCourse/,'review route must be awaited so errors are caught');
assert.match(worker,/return await testProvider/,'provider test route must be awaited so errors are caught');
assert.match(worker,/version:'0\.9\.3\.3'/);
const match=admin.match(/<script>([\s\S]*)<\/script>/);assert(match,'admin inline script missing');
const tmp=path.join(os.tmpdir(),`fluency-admin-${process.pid}.js`);fs.writeFileSync(tmp,match[1]);const checked=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});fs.unlinkSync(tmp);assert.equal(checked.status,0,checked.stderr);
console.log('Admin stabilization static checks passed.');

assert.match(admin,/Upload image ZIP/);assert.match(admin,/c.width=512/);assert.match(admin,/c.height=512/);assert.match(admin,/Duplicate image filename in ZIP/);

assert.ok(!worker.includes('image_assets'),'obsolete image_assets table reference');
assert.ok(!worker.includes('course_image_links'),'obsolete course_image_links table reference');
assert.match(worker,/INSERT OR REPLACE INTO images\(/);
assert.match(worker,/INSERT OR REPLACE INTO course_card_images\(/);
