import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
const candidates=['node_modules/coi-serviceworker/coi-serviceworker.min.js','node_modules/coi-serviceworker/coi-serviceworker.js'];
for(const candidate of candidates){try{await access(candidate,constants.R_OK);await copyFile(candidate,path.join('dist','coi-serviceworker.js'));console.log(`Copied ${candidate} -> dist/coi-serviceworker.js`);process.exit(0)}catch{}}
throw new Error('coi-serviceworker dependency was not found after build. Run npm install first.');
