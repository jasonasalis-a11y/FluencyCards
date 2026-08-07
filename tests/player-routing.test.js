import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../student/index.html',import.meta.url),'utf8');
const course=JSON.parse(fs.readFileSync(new URL('./fixtures/English_for_Khmer_v0.9.4_importable.json',import.meta.url),'utf8'));
const activityStart=html.indexOf('function activityKind');
const flattenEnd=html.indexOf('async function openCourse',activityStart);
assert.ok(activityStart>=0&&flattenEnd>activityStart,'player routing functions not found');
const context={};
vm.createContext(context);
vm.runInContext(html.slice(activityStart,flattenEnd),context);

function counts(items){return items.reduce((m,x)=>(m[x.type]=(m[x.type]||0)+1,m),{});}

test('published lesson routes every activity to the correct renderer',()=>{
  const items=context.flatten(course);
  assert.deepEqual(counts(items),{introduce:18,multiple_choice:3,recall:18,conversation:1});
  assert.equal(items.length,40);
  assert.equal(items.find(x=>x.type==='conversation').turns.length,8);
});

test('structural routing survives incorrect or missing type labels',()=>{
  const altered=structuredClone(course);
  const lesson=altered.lessons[0];
  for(const q of lesson.activities.filter(a=>a.choices))q.type='introduce';
  lesson.assessment.find(a=>a.turns).type='prompt_speak';
  const items=context.flatten(altered);
  assert.deepEqual(counts(items),{introduce:18,multiple_choice:3,recall:18,conversation:1});
});
