import {services,ADMIN_UID} from './admin.mjs';
if(!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulator only');
const {auth}=services();
const account={uid:ADMIN_UID,email:'admin@example.test',password:'Local-test-only-739!',emailVerified:true};
try{await auth.createUser(account);}catch(e){if(e.code!=='auth/uid-already-exists')throw e;await auth.updateUser(ADMIN_UID,account);}
try{await auth.createUser({uid:'P1',email:'parent1@test.com',password:'Local-test-only-739!',emailVerified:true});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;await auth.updateUser('P1',{email:'parent1@test.com',password:'Local-test-only-739!',emailVerified:true});}
console.log('Emulator admin and parent fixtures ready');
process.exit(0);
