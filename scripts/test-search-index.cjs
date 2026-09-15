const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {performance}=require('node:perf_hooks');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/view-index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest});
const {buildTextSearchIndex,searchTextIndex}=exportsForTest;
const rows=Array.from({length:3000},(_,i)=>({id:String(i),name:['Thiện Trần','TRỢ GIẢNG','Nguyễn Thị Ánh',''][i%4],objective:i%7===0?undefined:'Mục tiêu học tập '+i+' '+('Nội dung bài học. '.repeat(25)),grade:'Khối '+(i%12+1)}));
const fields=row=>[row.name,row.objective];
let calls=0;
const start=performance.now();
const index=buildTextSearchIndex(rows,row=>{calls++;return fields(row);});
const buildMs=performance.now()-start;
const terms=['','  ','thiện','TRỢ','Nguyễn','nguyen','mục tiêu','MỤC TIÊU','  ánh  ','không tìm thấy','12','nội dung bài học.'];
const before=(query,include)=>{const term=query.trim().toLowerCase();return rows.filter(row=>(!include||include(row))&&(!term||fields(row).filter(Boolean).join(' ').toLowerCase().includes(term)));};
for(const term of terms)for(const grade of ['all','Khối 1','Khối 12']){
 const include=grade==='all'?undefined:row=>row.grade===grade;
 const expected=before(term,include),actual=Array.from(searchTextIndex(index,term,include));
 assert.deepEqual(actual,expected);
 actual.forEach((row,i)=>assert.equal(row,expected[i],'preserve reference and ordering'));
}
assert.equal(calls,rows.length,'must not normalize fields again during search');
assert.equal(rows[0].name,'Thiện Trần','do not mutate source');
const changed=rows.map((row,i)=>i===0?{...row,name:'Tên mới',objective:'updated'}:row);
assert.ok(searchTextIndex(buildTextSearchIndex(changed,fields),'tên mới').some(row=>row.id==='0'),'source refresh reflects edits');
function median(run){const samples=[];for(let i=0;i<9;i++){const t=performance.now();for(const term of terms)run(term);samples.push(performance.now()-t);}return samples.sort((a,b)=>a-b)[4];}
console.log(JSON.stringify({passed:true,cases:36,rows:rows.length,indexBuildMs:+buildMs.toFixed(2),legacySearchMedianMs:+median(term=>before(term)).toFixed(2),indexedSearchMedianMs:+median(term=>searchTextIndex(index,term)).toFixed(2),note:'Local CPU only, 12 queries per sample; not browser latency.'}));
