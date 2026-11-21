// Disabled-by-default functional parent projection worker. No provider sends.
import {authenticatedWorkerStore} from '../services/parent-backend/client-store.mjs';
import {projectLegacyData} from '../services/parent-backend/worker.mjs';
if(!process.argv.includes('--stage-only'))console.log('Parent worker held; --stage-only required. No messages sent.');
else {
 const db=await authenticatedWorkerStore();
 const result=await projectLegacyData(db);
 console.log(JSON.stringify(result));
 console.log('Private parent projections/jobs staged. No external messages sent.');
 process.exit(0);
}
