import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
const testEnv = await initializeTestEnvironment({ projectId: 'demo-meezan', firestore: { host: '127.0.0.1', port: 8085 } });
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'parents/P1'), { id: 'P1', authUid: 'P1', fullName: 'أم يوسف التجريبية', email: 'parent1@test.com', phone: '01000000001', code: 'PAR-555555', status: 'approved', createdAt: '2026-11-21T12:00:00.000Z' });
  await setDoc(doc(db, 'parents/P2'), { id: 'P2', authUid: 'P2', fullName: 'أبو سارة', email: 'parent2@test.com', phone: '01000000002', code: 'PAR-666666', status: 'pending', createdAt: '2026-11-21T13:00:00.000Z' });
  await setDoc(doc(db, 'parent_codes/PAR-555555'), { uid: 'P1' });
  await setDoc(doc(db, 'parent_codes/PAR-666666'), { uid: 'P2' });
  await setDoc(doc(db, 'parent_links/P1'), { children: { S1: { studentId: 'S1', name: 'يوسف أحمد', code: 'USR-123456', linkedBy: 'parent', linkedAt: '2026-11-21T12:30:00.000Z' } } });
  await setDoc(doc(db, 'student_links/S1'), { studentId: 'S1', parents: { P1: { parentUid: 'P1', linkedBy: 'parent', linkedAt: '2026-11-21T12:30:00.000Z' } } });
});
console.log('parents seeded');
await testEnv.cleanup();
process.exit(0);
