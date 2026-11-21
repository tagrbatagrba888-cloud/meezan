// Synthetic/local preview runner only. Not a production hosting arrangement.
import {createServer} from 'node:http';
import {createHandler} from './api.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Local server requires both emulators');
const server=createServer(createHandler({origin:'http://127.0.0.1:8899'}));
server.listen(3790,'127.0.0.1',()=>console.log('Emulator-only parent API listening on local port 3790'));
