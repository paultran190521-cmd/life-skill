const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const policy={exports:{}}; vm.runInNewContext(compile(fs.readFileSync('lib/chat-retention.ts','utf8')),policy);
const range={exports:{}}; vm.runInNewContext(compile(fs.readFileSync('lib/date-range.ts','utf8')),range);
assert.throws(()=>range.exports.parseDateRange(new URLSearchParams('from=2026-02-30&to=2026-03-01')));
assert.throws(()=>range.exports.parseDateRange(new URLSearchParams('from=2026-01-01&to=2026-12-31')));
assert.equal(range.exports.parseDateRange(new URLSearchParams('from=2026-09-01&to=2026-09-30')).to,'2026-09-30');
let role='teacher', teacherId='t1';
const rows=Array.from({length:85},(_,i)=>({id:`m${String(i).padStart(3,'0')}`,lessonPlanId:'p1',senderUserId:'u1',content:`text ${i}`,createdAt:'2020-01-01T00:00:00Z'}));
const attachments=rows.map(row=>({id:`a${row.id}`,lessonPlanId:'p1',messageId:row.id,kind:'image',mimeType:'image/png',createdAt:row.createdAt,driveFileId:'file',url:'https://private.test/image'}));
const exportsObject={};
vm.runInNewContext(compile(fs.readFileSync('app/api/lesson-plans/[id]/messages/route.ts','utf8')),{
 exports:exportsObject,URL,Response,console,
 require(name){
   if(name==='next/server') return {NextResponse:Response};
   if(name==='@/lib/chat-retention') return policy.exports;
   if(name==='@/lib/route-auth') return {requireSessionUser:async()=>({user:{role,teacherId}}),evaluatePermission:({allowed})=>({allowed})};
   if(name==='@/lib/google-sheets') return {ensureSheetHeaders:async()=>{},readSheetRowById:async()=>({id:'p1',teacherId:'t1'}),readSheetRows:async(name)=>name==='LessonPlanMessages'?rows:attachments};
   if(name==='@/lib/api') return {createRequestId:()=> 'test',apiFailure:(status,message)=>Response.json({message},{status}),apiError:()=>Response.json({}, {status:500})};
   if(name==='@/lib/audit') return {};
   throw new Error(name);
 }
});
async function get(suffix=''){return exportsObject.GET(new Request(`https://example.test/api/lesson-plans/p1/messages${suffix}`),{params:Promise.resolve({id:'p1'})});}
(async()=>{
 const first=await (await get()).json(); assert.equal(first.messages.length,40); assert.equal(first.nextCursor,'m045');
 assert.equal(first.attachments.length,40); assert.equal(first.attachments[0].expired,true); assert.equal(first.attachments[0].url,'');
 const second=await (await get('?before=m045')).json(); assert.equal(second.messages.length,40); assert.equal(second.nextCursor,'m005');
 const last=await (await get('?before=m005')).json(); assert.equal(last.messages.length,5); assert.equal(last.nextCursor,null);
 assert.equal(new Set([...first.messages,...second.messages,...last.messages].map(row=>row.id)).size,85);
 assert.equal((await get('?before=unknown')).status,400);
 teacherId='other'; assert.equal((await get()).status,403);
 role='admin'; assert.equal((await get()).status,200);
 console.log('Chat pages passed: 85 messages, stable same-timestamp cursor, no duplicates, scoped attachments, expiry, permissions and date range validation. No network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
