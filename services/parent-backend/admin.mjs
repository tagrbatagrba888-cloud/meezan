// This module refuses production credentials until activation is explicitly configured.
import {initializeApp, getApps, cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
export const ADMIN_UID='4KbUOO6wrHf3jzzKvGIltsNyzFX2';
export function services(){
 const emulator=process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
 if(!emulator && process.env.MEEZAN_PARENT_ACTIVATED!=='yes')throw new Error('Parent production activation is disabled');
 let app=getApps().find(a=>a.name==='meezan-parent-backend');
 if(!app){
  const opts=emulator?{projectId:'demo-meezan'}:{credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}')),projectId:'qanon-c716d'};
  app=initializeApp(opts,'meezan-parent-backend');
 }
 return {auth:getAuth(app),db:getFirestore(app)};
}
export async function authenticate(bearer){
 if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))throw new Error('Authentication required');
 const {auth}=services();
 const identity=await auth.verifyIdToken(bearer.slice(7),true);
 if(!identity.uid)throw new Error('Authentication required');
 return identity;
}
export function requireAdmin(identity){if(identity?.uid!==ADMIN_UID)throw new Error('Admin required');}
