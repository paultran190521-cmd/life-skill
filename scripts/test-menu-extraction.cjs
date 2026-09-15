const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const baseline=execFileSync('git',['show','c363c7e:components/mettasoul-app.tsx'],{encoding:'utf8',maxBuffer:4*1024*1024});
const current=fs.readFileSync('components/mettasoul-app.tsx','utf8');
function parse(text){return ts.createSourceFile('view.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function find(tree,name){let result;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)result=n;ts.forEachChild(n,visit);}visit(tree);assert.ok(result,name);return result;}
const before=parse(baseline),after=parse(current);
for(const [oldName,newName,file] of [['renderLessonsPanel','LessonsPanel','lessons-panel'],['renderTeachersPanel','TeachersPanel','teachers-panel']]){
 const module=parse(fs.readFileSync('components/menus/'+file+'.tsx','utf8'));
 const original=find(before,oldName).body.getText(before).replace(/\s+/g,' ');
 const extracted=find(module,newName).body.getText(module).replace(/\s+/g,' ');
 assert.equal(extracted,original,newName+' changed view or event handlers');
 const wrapper=find(after,oldName);
 let element;function visit(n){if(ts.isJsxSelfClosingElement(n))element=n;ts.forEachChild(n,visit);}visit(wrapper);
 assert.equal(element.tagName.getText(after),newName);
 const supplied=new Set();
 for(const prop of element.attributes.properties){assert.ok(ts.isJsxAttribute(prop));assert.equal(prop.initializer.expression.getText(after),prop.name.text,'callback/data must be passed unchanged');supplied.add(prop.name.text);}
 for(const prop of find(module,newName).parameters[0].name.elements)assert.ok(supplied.has(prop.name.text),'missing prop '+prop.name.text);
 assert.ok(current.includes('import("@/components/menus/'+file+'")'),'must remain a lazy import');
}
const panel=parse(fs.readFileSync('components/menus/panel.tsx','utf8'));
assert.equal(find(panel,'Panel').body.getText(panel),find(before,'Panel').body.getText(before));
const teachers=parse(fs.readFileSync('components/menus/teachers-panel.tsx','utf8'));
assert.equal(find(teachers,'TeacherTableRow').body.getText(teachers),find(before,'TeacherTableRow').body.getText(before));
console.log('Menu extraction passed: unchanged JSX/event handlers, exact data/callback wiring, shared Panel and teacher editor, lazy module boundaries. No writes.');
