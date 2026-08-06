import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const schema=fs.readFileSync(new URL('../../worker-admin/schema.sql',import.meta.url),'utf8');
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
db.exec(schema);
const required={
  images:['image_id','concept_id','file_name','r2_key','file_size','sha256'],
  course_card_images:['course_id','course_version','lesson_id','activity_id','image_id']
};
for(const [table,columns] of Object.entries(required)){
  const actual=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name));
  if(!actual.size)throw new Error(`Canonical schema did not create ${table}`);
  for(const column of columns)if(!actual.has(column))throw new Error(`${table}.${column} missing from canonical schema`);
}
console.log('Canonical schema SQLite smoke test passed.');
