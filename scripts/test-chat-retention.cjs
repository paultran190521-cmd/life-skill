const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const policy = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/chat-retention.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,policy);
const code = fs.readFileSync('scripts/gas-chat-retention.js','utf8');
const dates = {};
vm.runInNewContext(code, dates);
for (const [input, expected] of [['2026-09-30T08:00:00Z','2027-02-28T08:00:00Z'],['2023-09-30T08:00:00Z','2024-02-29T08:00:00Z'],['2026-01-15T08:00:00Z','2026-06-15T08:00:00Z']]) {
  assert.equal(dates.chatImageExpiryMs_(input), Date.parse(expected));
  assert.equal(policy.exports.chatImageExpiresAt(input), dates.chatImageExpiryMs_(input));
}
assert.equal(policy.exports.isExpiredChatImage({kind:'image',createdAt:'2026-01-15T08:00:00Z'},Date.parse('2026-06-15T08:00:00Z')),true);
assert.equal(policy.exports.isExpiredChatImage({kind:'image',createdAt:'bad'}),false);
assert.equal(policy.exports.isExpiredChatImage({kind:'file',createdAt:'2020-01-01'}),false);
const headers = ['id','kind','createdAt','driveFileId','lessonPlanId','expiredAt'];
const fresh = new Date().toISOString();
const records = [
  ['old','image','2020-01-01','old','p',''],
  ['new','image',fresh,'new','p',''],
  ['pdf','file','2020-01-01','pdf','p',''],
  ['bad-date','image','invalid','bad-date','p',''],
  ['outside','image','2020-01-01','outside','p',''],
  ['shared-old','image','2020-01-01','shared','p',''],
  ['shared-new','image',fresh,'shared','p',''],
  ['main-plan','image','2020-01-01','main-plan','p',''],
  ['failure','image','2020-01-01','failure','p',''],
];
const trashed = [];
const iterator = items => { let i=0; return {hasNext:()=>i<items.length,next:()=>items[i++]}; };
const sheet = {getLastRow:()=>records.length+1,getDataRange:()=>({getValues:()=>[headers,...records]}),getRange:(row,col)=>({getValue:()=>records[row-2][col-1],setValue:value=>{records[row-2][col-1]=value;}})};
const context = {SPREADSHEET_ID:'db',LESSON_PLAN_CHAT_FOLDER_ID:'chat-root',console:{error:()=>{}},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:name=>name==='LessonPlanAttachments'?sheet:{getDataRange:()=>({getValues:()=>[['driveFileId'],['main-plan']]})}})},
 PropertiesService:{getScriptProperties:()=>({setProperty:()=>{}})},
 DriveApp:{getFileById:id=>{
   if(id==='failure') throw new Error('temporary');
   return {getMimeType:()=> 'image/png',isTrashed:()=>trashed.includes(id),setTrashed:()=>trashed.push(id),getParents:()=>iterator([{getName:()=> 'lesson-plan-p',getParents:()=>iterator([{getId:()=> id==='outside'?'other-root':'chat-root'}])}])};
 }}
};
vm.runInNewContext(code,context);
context.cleanupExpiredChatImages({dryRun:true});
assert.equal(trashed.length,0);
const result = context.cleanupExpiredChatImages({dryRun:false});
assert.deepEqual(trashed,['old']);
assert.equal(result.failed,1);
assert.equal(result.skipped,3);
assert.ok(records[0][5]);
context.cleanupExpiredChatImages({dryRun:false});
assert.deepEqual(trashed,['old'],'rerun is idempotent');
console.log('Chat retention passed: calendar boundaries, TS/GAS parity, dry-run, root verification, file reuse, lesson-plan protection, error retry and idempotency. No real files touched.');
