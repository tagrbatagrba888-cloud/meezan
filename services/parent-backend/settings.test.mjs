import {test} from 'node:test';import assert from 'node:assert/strict';import {reportSettings,REPORT_TYPES} from './settings.mjs';
test('no configured controls means reports paused, not silent default sends',()=>{const s=reportSettings(null);assert.equal(s.enabled,false);assert.ok(Object.values(s.channels).every(v=>v===false));});
test('only grounded report types and explicit channels supported, two days fixed',()=>{
 const s=reportSettings({schemaVersion:1,enabled:true,types:{exam_result:true,attendance:true},channels:{email:true,sms:true},unsolvedHomeworkDelayHours:1,historyPolicy:'all'});
 assert.equal(s.enabled,true);assert.equal(s.types.exam_result,true);assert.equal(s.types.attendance,undefined);assert.equal(s.channels.sms,undefined);assert.equal(s.unsolvedHomeworkDelayHours,48);assert.equal(s.historyPolicy,'future_only');assert.equal(REPORT_TYPES.length,4);
});
