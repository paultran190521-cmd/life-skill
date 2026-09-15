const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const appPath = path.resolve('components/mettasoul-app.tsx');
const baseline = execFileSync('git', ['show', '641f693:components/mettasoul-app.tsx'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const day = new Date().toISOString().slice(0, 10);
const teachers = ['t1', 't2'].map(id => ({ id, name: id, phone: '0900000000', email: `${id}@example.test`, active: true }));
const lessons = Array.from({length:4},(_,i)=>({ id:`l${i}`, title:`Lesson ${i}`, grade:'Khối 6', objective:'Mục tiêu 1: One. Mục tiêu 2: Two.', lesson1Name:'Section one',lesson1Objective:'One',lesson2Name:'Section two',lesson2Objective:'Two',durationMinutes:45,active:true }));
const schedules = [0,1,2].map(i=>({id:`event${i}`,date:day,teacherId:'t1',schoolId:'s1',classId:'c1',lessonId:`l${i}`,timeSlotId:'slot1',teachingEnvironment:'in_class',status:'sent',assistantIds:'t2',lessonPeriods:'lesson1',participantScope:'single_class',createdAt:`${day}T00:00:00Z`}));
const fixture = {
  activeTab:'dashboard', authStatus:'signed-in', dataStatus:'connected',
  currentUserId:'admin',sessionUserId:'admin',
  appUsers:[{id:'admin',name:'Admin',email:'admin@example.test',role:'admin',isActive:true},{id:'teacher',name:'Teacher',email:'teacher@example.test',role:'teacher',teacherId:'t1',isActive:true},{id:'assistant',name:'Assistant',email:'assistant@example.test',role:'assistant',teacherId:'t2',isActive:true}],
  teachers, lessons, schedules,
  schools:[{id:'s1',name:'School one',address:'Test',active:true}],
  classes:[{id:'c1',schoolId:'s1',name:'6A1',grade:'Khối 6'}],
  timeSlots:[{id:'slot1',label:'School one - Tiết 1',start:'07:00',end:'07:45',active:true}],
  attendance:[{id:'a1',scheduleId:'event0',teacherId:'t1',checkedInAt:`${day}T00:00:00Z`,latitude:0,longitude:0}],
  lessonPlans:[{id:'p1',scheduleId:'event0',teacherId:'t1',fileName:'Plan.pdf',driveUrl:'https://example.test/plan',uploadedAt:`${day}T00:00:00Z`}],
};

function seedState(source) {
  const file = ts.createSourceFile(appPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  function visit(node){
    if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(file)==='useState'){
      const name=node.name.elements[0].name.getText(file);
      if(Object.hasOwn(fixture,name)) edits.push([node.initializer.getStart(file),node.initializer.end,`useState(__fixture[${JSON.stringify(name)}])`]);
    }
    ts.forEachChild(node,visit);
  }
  visit(file);
  for(const [start,end,text] of edits.sort((a,b)=>b[0]-a[0])) source=source.slice(0,start)+text+source.slice(end);
  return source;
}

function loadApp(appSource){
  const cache=new Map();
  function load(file){
    if(cache.has(file)) return cache.get(file);
    const exports={};cache.set(file,exports);
    const code=file===appPath?seedState(appSource):fs.readFileSync(file,'utf8');
    const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const localRequire=(name)=>{
      if(name==='next/dynamic') return ()=>()=>null; // Network-loaded school guide is verified in browser.
      if(name.startsWith('@/')) {
        const target=path.resolve(name.slice(2));
        return load(fs.existsSync(target+'.tsx')?target+'.tsx':target+'.ts');
      }
      return require(name);
    };
    vm.runInNewContext(compiled,{exports,require:localRequire,__fixture:fixture,console,URL,Date,Intl,Map,Set,process},{filename:file});
    return exports;
  }
  return load(appPath).MettasoulApp;
}
const Before=loadApp(baseline), After=loadApp(fs.readFileSync(appPath,'utf8'));
const menus={admin:['dashboard','assignment','calendar','teachers','lessons','plans','attendance','settings'],teacher:['dashboard','calendar','plans','attendance'],assistant:['dashboard','calendar','plans','attendance']};
function visibleText(html){return html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
let cases=0;
for(const [role,tabs] of Object.entries(menus)){
  fixture.currentUserId=role;
  for(const tab of tabs){
    fixture.activeTab=tab;
    const oldHtml=renderToStaticMarkup(React.createElement(Before));
    const newHtml=renderToStaticMarkup(React.createElement(After));
    assert.equal(visibleText(newHtml),visibleText(oldHtml),`Visible content changed for ${role}/${tab}`);
    cases++;
  }
}
console.log(`Menu rendering passed: ${cases} role/menu combinations preserve visible content with fixture data. No network or database writes.`);
