// Authenticated Firestore client adapter for the parent worker. Honors deployed
// rules and verifies the exact existing admin UID. No service-account key needed.
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,collection,getDoc,getDocs,setDoc,updateDoc,runTransaction,query,where,limit} from 'firebase/firestore';
const snap=s=>({exists:s.exists(),id:s.id,data:()=>s.data()});
export function clientStore(firestore){
 const ref=path=>({path,get:async()=>snap(await getDoc(doc(firestore,path))),set:(data,opts)=>setDoc(doc(firestore,path),data,opts||{}),update:data=>updateDoc(doc(firestore,path),data)});
 const native=r=>doc(firestore,r.path);
 const store={doc:ref,runTransaction:fn=>runTransaction(firestore,tx=>fn({
  get:async r=>snap(await tx.get(native(r))),set:(r,d,o)=>{tx.set(native(r),d,o||{});},update:(r,d)=>{tx.update(native(r),d);},create:(r,d)=>{tx.set(native(r),d);}
 }))};
 store.collection=path=>{
  const make=constraints=>({where:(...args)=>make([...constraints,where(...args)]),limit:n=>make([...constraints,limit(n)]),get:async()=>{
   const s=await getDocs(query(collection(firestore,path),...constraints));return {size:s.size,docs:s.docs.map(d=>({...snap(d),ref:ref(d.ref.path)}))};
  }});return make([]);
 };
 return store;
}
export async function authenticatedWorkerStore(){
 const emulator=process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST;
 if(!emulator&&process.env.MEEZAN_PARENT_WORKER_ENABLED!=='yes')throw new Error('Parent worker disabled');
 const config=emulator?{apiKey:'demo-key',projectId:'demo-meezan',authDomain:'demo-meezan.firebaseapp.com'}:{apiKey:'AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0',projectId:'qanon-c716d',authDomain:'qanon-c716d.firebaseapp.com'};
 const app=getApps().find(a=>a.name==='parent-worker')||initializeApp(config,'parent-worker');
 const auth=getAuth(app),db=getFirestore(app);
 if(emulator){const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(db,host,Number(port));connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});}
 const expected='4KbUOO6wrHf3jzzKvGIltsNyzFX2';
 if(process.env.MEEZAN_ADMIN_UID!==expected)throw new Error('Expected parent admin identity missing');
 const credential=await signInWithEmailAndPassword(auth,process.env.MEEZAN_ADMIN_EMAIL||'',process.env.MEEZAN_ADMIN_PASSWORD||'');
 if(credential.user.uid!==expected)throw new Error('Unexpected parent worker identity');
 return clientStore(db);
}
