import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCourse,providerRequest} from '../worker-admin/src/index.js';

const course={course_id:'x',title:{learning:'Test'},learning_language:'en-US',lessons:[{id:'L1',skills:[{id:'S1',learning_text:'Hello',native_text:'Hi',model_audio:'courses/x/audio/hello.mp3'}]}]};

test('course validation accepts schema skills and audio',()=>{const r=validateCourse(course);assert.equal(r.valid,true);assert.equal(r.audio_reference_count,1)});
test('course validation rejects duplicate lesson IDs',()=>{const bad={...course,lessons:[course.lessons[0],course.lessons[0]]};assert.equal(validateCourse(bad).valid,false)});
test('course validation rejects duplicates within one collection',()=>{const bad={...course,lessons:[{...course.lessons[0],skills:[course.lessons[0].skills[0],course.lessons[0].skills[0]]}]};assert.equal(validateCourse(bad).valid,false)});
test('same identifier in different collections is not a false duplicate',()=>{const c={course_id:'x',title:{learning:'Test'},lessons:[{id:'L1',skills:[{id:'S1'}],activities:[{id:'S1',type:'reference'}]}]};assert.equal(validateCourse(c).valid,true)});
test('Google request uses stable v1 endpoint and x-goog-api-key',()=>{const r=providerRequest('google','Flash3.6','prompt',{GOOGLE_API_KEY:'AQ.test'});assert.equal(r.headers['x-goog-api-key'],'AQ.test');assert.match(r.endpoint,/\/v1\/models\/gemini-3.6-flash:generateContent$/);assert.ok(!r.endpoint.includes('key='))});
test('OpenAI request uses Responses API bearer auth',()=>{const r=providerRequest('openai','gpt-5-mini','prompt',{OPENAI_API_KEY:'sk-test'});assert.equal(r.endpoint,'https://api.openai.com/v1/responses');assert.equal(r.headers.Authorization,'Bearer sk-test')});
test('OpenRouter request uses chat completions bearer auth',()=>{const r=providerRequest('openrouter','google/gemini-3.6-flash','prompt',{OPENROUTER_API_KEY:'or-test'},'https://example.com');assert.equal(r.endpoint,'https://openrouter.ai/api/v1/chat/completions');assert.equal(r.headers.Authorization,'Bearer or-test')});
test('provider secrets are trimmed',()=>{const r=providerRequest('google','gemini-3.6-flash','prompt',{GOOGLE_API_KEY:'  "AQ.test"  '});assert.equal(r.headers['x-goog-api-key'],'AQ.test')});
