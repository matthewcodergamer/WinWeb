import { readFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const lock=JSON.parse(await readFile(new URL('../upstreams.lock.json',import.meta.url),'utf8'));
const includeGpl=process.env.XRUN_INCLUDE_GPL==='1';
const includeResearch=process.env.XRUN_INCLUDE_RESEARCH==='1';
await mkdir('upstream',{recursive:true});
for(const project of lock.projects){
  const shouldSync=project.syncByDefault||(project.license.startsWith('GPL')&&includeGpl)||(project.role.includes('research')&&includeResearch);
  if(!shouldSync){console.log(`skip ${project.id} (${project.license}); enable with XRUN_INCLUDE_GPL=1 or XRUN_INCLUDE_RESEARCH=1 when appropriate`);continue}
  const destination=path.join('upstream',project.id);await rm(destination,{recursive:true,force:true});
  let run=spawnSync('git',['clone','--filter=blob:none','--no-checkout',project.repo,destination],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
  run=spawnSync('git',['-C',destination,'checkout',project.ref],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
  if(project.id==='bottleship'){run=spawnSync('git',['-C',destination,'submodule','update','--init','--recursive'],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1)}
  console.log(`synced ${project.id} @ ${project.ref}`);
}
