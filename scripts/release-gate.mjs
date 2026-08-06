import {spawnSync} from 'node:child_process';
const steps=[
  ['node',['--test','tests/core.test.js']],
  ['node',['tests/static-check.mjs']],
  ['node',['tests/contracts/validate-schema-contract.mjs']],
  ['node',['tests/contracts/schema-smoke.mjs']],
  ['node',['--check','worker-admin/src/index.js']]
];
for(const [cmd,args] of steps){
  const r=spawnSync(cmd,args,{stdio:'inherit'});
  if(r.status!==0)process.exit(r.status??1);
}
console.log('Release gate passed.');
