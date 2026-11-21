import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({ projectId: 'demo-meezan', firestore: { rules, host: '127.0.0.1', port: 8085 } });
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admin_gate/gate'), { pin: '9999' });
  await setDoc(doc(db, 'parents/P1'), { id: 'P1', authUid: 'P1', code: 'PAR-111111', status: 'approved' });
  await setDoc(doc(db, 'student_codes/USR-123456'), { studentId: 'S1' });
  await setDoc(doc(db, 'student_results/S1'), { studentId: 'S1', items: [{ name: 'Q', score: 9, total: 10 }] });
});
const p1 = testEnv.authenticatedContext('P1').firestore();
// replicate parent.html's exact batch
const batch = writeBatch(p1);
const now = new Date().toISOString();
batch.set(doc(p1, 'parent_links', 'P1'), { children: { S1: { name: 'يوسف', code: 'USR-123456', linkedAt: now, linkedBy: 'parent' } }, viaCode: 'USR-123456', updatedAt: now }, { merge: true });
batch.set(doc(p1, 'student_links', 'S1'), { parents: { P1: { name: 'أم يوسف', linkedAt: now, linkedBy: 'parent' } }, viaCode: 'USR-123456', updatedAt: now }, { merge: true });
await assertSucceeds(batch.commit());
console.log('batch commit OK');
await assertSucceeds(getDoc(doc(p1, 'student_results', 'S1')));
console.log('student_results read as linked parent OK');
await testEnv.cleanup();
process.exit(0);
