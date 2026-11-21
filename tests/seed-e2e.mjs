import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
const testEnv = await initializeTestEnvironment({ projectId: 'demo-meezan', firestore: { host: '127.0.0.1', port: 8085 } });
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const put = (p, d) => setDoc(doc(db, p), d);
  await put('settings/login_user', { parentRegisterEnabled: true, parentLoginEnabled: true, parentApprovalRequired: false, studentLoginEnabled: true });
  await put('admin_gate/gate', { pin: '9999' });
  await put('users/all', { items: [{ id: 'S1', username: 'yousef_test', fullName: 'يوسف أحمد', code: 'USR-123456', grade: 'الصف الثالث الإعدادي' }] });
  await put('student_codes/USR-123456', { studentId: 'S1' });
  await put('student_results/S1', { studentId: 'S1', items: [
    { key: 'exam_E1', kind: 'exam', itemId: 'E1', itemName: 'امتحان الفقه: أبواب الطهارة', score: 18, totalScore: 20, percent: 90, correctedAt: '2026-11-20T14:00:00.000Z' },
    { key: 'homework_H1', kind: 'homework', itemId: 'H1', itemName: 'واجب السيرة النبوية', score: 9, totalScore: 10, percent: 90, correctedAt: '2026-11-19T10:00:00.000Z' }
  ], updatedAt: '2026-11-20T14:05:00.000Z' });
});
console.log('seeded');
await testEnv.cleanup();
process.exit(0);
