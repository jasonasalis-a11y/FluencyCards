import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const schemaText=fs.readFileSync(path.join(root,'worker-admin/schema.sql'),'utf8');
const sources=[path.join(root,'worker-admin/src/index.js')];
const optionalPublic=path.join(root,'worker-public/src/index.js');
if(fs.existsSync(optionalPublic))sources.push(optionalPublic);

function parseSchema(sql){
  const tables=new Map();
  for(const m of sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][\w]*)\s*\(([\s\S]*?)\);/gi)){
    const cols=new Set();
    for(const raw of m[2].split(/,(?![^()]*\))/)){
      const line=raw.trim();
      const c=line.match(/^([A-Za-z_][\w]*)\s+/);
      if(c&&!/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(c[1]))cols.add(c[1]);
    }
    tables.set(m[1],cols);
  }
  return tables;
}
const tables=parseSchema(schemaText);
assert(tables.size>0,'No tables parsed from canonical schema');
const allow=new Set(['sqlite_master','SET']);
const errors=[];
for(const file of sources){
  const src=fs.readFileSync(file,'utf8');
  const sqlStrings=[...src.matchAll(/(?:prepare|exec)\(\s*`([\s\S]*?)`\s*\)|(?:prepare|exec)\(\s*'([^']*)'\s*\)|(?:prepare|exec)\(\s*"([^"]*)"\s*\)/g)].map(m=>m[1]||m[2]||m[3]||'');
  for(const sql of sqlStrings){
    const refs=[...sql.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+([A-Za-z_][\w]*)/gi)].map(m=>m[1]);
    for(const t of refs)if(!tables.has(t)&&!allow.has(t))errors.push(`${path.basename(file)} references unknown table ${t}: ${sql.slice(0,120)}`);
    const ins=sql.match(/INSERT(?:\s+OR\s+\w+)?\s+INTO\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/i);
    if(ins&&tables.has(ins[1]))for(const col of ins[2].split(',').map(x=>x.trim()).filter(Boolean))if(!tables.get(ins[1]).has(col))errors.push(`${path.basename(file)} inserts unknown column ${ins[1]}.${col}`);
    const upd=sql.match(/UPDATE\s+([A-Za-z_][\w]*)\s+SET\s+([\s\S]*?)(?:\s+WHERE|$)/i);
    if(upd&&tables.has(upd[1]))for(const assignment of upd[2].split(',')){const col=assignment.trim().match(/^([A-Za-z_][\w]*)\s*=/)?.[1];if(col&&!tables.get(upd[1]).has(col))errors.push(`${path.basename(file)} updates unknown column ${upd[1]}.${col}`)}
  }
}
assert.equal(errors.length,0,errors.join('\n'));
for(const required of ['images','course_card_images'])assert(tables.has(required),`Canonical schema missing ${required}`);
console.log(`Schema contract passed: ${tables.size} tables checked across ${sources.length} Worker source(s).`);
