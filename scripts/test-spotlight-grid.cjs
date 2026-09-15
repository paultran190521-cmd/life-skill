const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('components/spotlight-grid.tsx','utf8');
assert.ok(!source.includes('useState'),'pointer motion must not update React state');
function emitter(){const listeners=new Map();return {listeners,addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};}
const fine={...emitter(),matches:true},reduced={...emitter(),matches:false};
const win={...emitter(),matchMedia:q=>q.includes('reduced')?reduced:fine};
const doc={...emitter(),hidden:false};
const styles=new Map();let reads=0,writes=0;
const card={style:{setProperty(k,v){styles.set(k,v);writes++;},removeProperty(k){styles.delete(k);}},getBoundingClientRect(){reads++;return {left:0,top:0,width:100,height:100};}};
const grid={...emitter(),contains:t=>t===card};
class Element {closest(){return card;}}
let cleanup,frameId=0;const frames=new Map();
const effects=[];const exportsForTest={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:exportsForTest,window:win,document:doc,Element,
 requestAnimationFrame:f=>{frames.set(++frameId,f);return frameId;},cancelAnimationFrame:id=>frames.delete(id),
 require:n=>n==='react'?{useRef:()=>({current:grid}),useEffect:f=>effects.push(f)}:require(n),
});
exportsForTest.SpotlightGrid({className:'grid',children:'Cards'});cleanup=effects[0]();
const move=grid.listeners.get('pointermove');
const event={pointerType:'mouse',target:new Element(),clientX:100,clientY:0};
for(let i=0;i<100;i++)move(event);
assert.equal(frames.size,1);assert.equal(reads,1);assert.equal(writes,0);
for(const [id,cb]of frames){frames.delete(id);cb();}
assert.equal(styles.get('--spot-x'),'2.00deg');assert.equal(styles.get('--spot-y'),'2.00deg');assert.equal(writes,2);
grid.listeners.get('pointerleave')();assert.equal(styles.size,0);
reduced.matches=true;move(event);assert.equal(frames.size,0);
reduced.matches=false;fine.matches=false;move(event);assert.equal(frames.size,0);
fine.matches=true;move({...event,pointerType:'touch'});assert.equal(frames.size,0);
doc.hidden=true;move(event);assert.equal(frames.size,0);
doc.hidden=false;move(event);assert.equal(frames.size,1);
win.listeners.get('scroll')();assert.equal(frames.size,0);assert.equal(styles.size,0);
move(event);cleanup();assert.equal(frames.size,0);
for(const node of [grid,win,doc,fine,reduced])assert.equal(node.listeners.size,0,'all listeners cleaned up');
const css=fs.readFileSync('app/globals.css','utf8');
assert.ok(css.includes('.ui-polish .spotlight-grid > [data-stat-card]'));
assert.ok(css.includes('(prefers-reduced-motion: reduce), (hover: none), (pointer: coarse)'));
console.log('Spotlight passed: 100 pointer events batched to one frame, 2-degree cap, no React state, touch/reduced-motion/hidden guards, scroll reset and full cleanup. No network.');
