// Firestore rules tests for the parent-accounts gate. Emulator only — never live.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

const PROJECT = 'demo-meezan';
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules, host: '127.0.0.1', port: 8085 },
});

let pass = 0, fail = 0;
async function t(name, fn, expect) {
  try {
    const p = fn();
    if (expect === 'ok') { await assertSucceeds(p); } else { await assertFails(p); }
    pass++; console.log('PASS', name);
  } catch (e) { fail++; console.log('FAIL', name, '-', String(e).slice(0, 120)); }
}

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const put = (path, data) => setDoc(doc(db, path), data);
  await put('admin_gate/gate', { pin: '9999' });
  await put('settings/login_user', { parentApprovalRequired: true });
  await put('parents/P1', { id: 'P1', authUid: 'P1', fullName: 'Parent One', code: 'PAR-111111', status: 'approved' });
  await put('parents/P2', { id: 'P2', authUid: 'P2', fullName: 'Parent Two', code: 'PAR-222222', status: 'approved' });
  await put('parent_codes/PAR-111111', { uid: 'P1' });
  await put('parent_codes/PAR-222222', { uid: 'P2' });
  await put('student_codes/USR-123456', { studentId: 'S1' });
  await put('student_codes/USR-999999', { studentId: 'S2' });
  await put('student_links/S1', { studentId: 'S1', parents: { P1: { parentUid: 'P1', linkedBy: 'parent' } } });
  await put('parent_links/P1', { children: { S1: { studentId: 'S1', code: 'USR-123456', linkedBy: 'parent' } } });
  await put('student_results/S1', { studentId: 'S1', items: [{ name: 'Quiz 1', score: 8, total: 10 }] });
});

const anon = () => testEnv.unauthenticatedContext().firestore();
const asP1 = () => testEnv.authenticatedContext('P1').firestore();
const asP2 = () => testEnv.authenticatedContext('P2').firestore();

// 1. signed-out denied
await t('signed-out cannot read parent doc', () => getDoc(doc(anon(), 'parents/P1')), 'fail');
await t('signed-out cannot read student results', () => getDoc(doc(anon(), 'student_results/S1')), 'fail');
await t('signed-out cannot read student_links', () => getDoc(doc(anon(), 'student_links/S1')), 'fail');

// 2. cross-parent denied
await t('P2 cannot read P1 parent doc', () => getDoc(doc(asP2(), 'parents/P1')), 'fail');
await t('P2 cannot read results of S1 (not their child)', () => getDoc(doc(asP2(), 'student_results/S1')), 'fail');
await t('P2 cannot read links of S1', () => getDoc(doc(asP2(), 'student_links/S1')), 'fail');
await t('P2 cannot write parent_links of P1', () => setDoc(doc(asP2(), 'parent_links/P1'), { children: {} }), 'fail');

// 3. own reads OK
await t('P1 reads own parent doc', () => getDoc(doc(asP1(), 'parents/P1')), 'ok');
await t('P1 reads results of linked child S1', () => getDoc(doc(asP1(), 'student_results/S1')), 'ok');
await t('P1 reads own links', () => getDoc(doc(asP1(), 'parent_links/P1')), 'ok');


const admin = () => testEnv.authenticatedContext('4KbUOO6wrHf3jzzKvGIltsNyzFX2').firestore();
const put = (db, path, data) => setDoc(doc(db, path), data);
await t('parent cannot self-link even with valid code', () => put(asP1(), 'parent_links/P1', {children:{S2:{}},viaCode:'USR-999999'}), 'fail');
await t('signed-out cannot link even with valid codes', () => put(anon(), 'student_links/S2', {parents:{P2:{}},viaCode:'PAR-222222',viaChildCode:'USR-999999'}), 'fail');
await t('signed-out cannot forge student code', () => put(anon(), 'student_codes/USR-FORGED', {studentId:'S1'}), 'fail');
await t('parent cannot forge student code', () => put(asP2(), 'student_codes/USR-FORGED', {studentId:'S1'}), 'fail');
await t('PIN alone cannot authorize writes', () => put(anon(), 'parent_links/P2', {children:{S1:{}},adminPin:'9999'}), 'fail');
await t('wrong user plus correct PIN denied', () => put(asP2(), 'parent_links/P2', {children:{S1:{}},adminPin:'9999'}), 'fail');
await t('authenticated admin can link', () => put(admin(), 'parent_links/P2', {children:{S2:{}}}), 'ok');
await t('authenticated admin unlinks', () => put(admin(), 'student_links/S1', {parents:{}}), 'ok');
await t('unlink revokes results immediately', () => getDoc(doc(asP1(), 'student_results/S1')), 'fail');
const {getDocs, collection} = await import('firebase/firestore');
await t('parent list denied signed-out', () => getDocs(collection(anon(), 'parents')), 'fail');
await t('parent list denied non-admin', () => getDocs(collection(asP1(), 'parents')), 'fail');
await t('parent list allowed authenticated admin', () => getDocs(collection(admin(), 'parents')), 'ok');
for (const coll of ['admin_outbox','result_emails','result_emails_meta']) {
 await t(coll+' signed-out read denied', () => getDoc(doc(anon(), coll+'/test')), 'fail');
 await t(coll+' non-admin write denied', () => put(asP1(), coll+'/test', {x:1}), 'fail');
 await t(coll+' admin write allowed', () => put(admin(), coll+'/test', {x:1}), 'ok');
}
await t('result client writes denied', () => put(asP1(), 'student_results/S1', {items:[]}), 'fail');
console.log(`${pass} passed, ${fail} failed`);
await testEnv.cleanup();
process.exit(fail ? 1 : 0);
