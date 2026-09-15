const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function emitter(){const events=new Map();return {events,addEventListener(k,f){events.set(k,f);},removeEventListener(k){events.delete(k);}};}
let enabled=true,inside=true,blocked=false,fail=false;const nodes=new Set(),timers=new Map();let id=0;
class Element { animate(){if(fail)throw Error('unsupported');return {cancel(){}};} closest(q){return q==='button'?button:null;} }
const button={closest:q=>q==='.ui-polish'?inside:blocked,matches:()=>!enabled,getBoundingClientRect:()=>({left:10,top:20,right:110,bottom:60,width:100,height:40})};
const reduced={...emitter(),matches:false};
const win={...emitter(),matchMedia:()=>reduced,setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:id=>timers.delete(id)};
const doc={...emitter(),hidden:false,body:{appendChild:n=>nodes.add(n)},createElement:()=>({style:{},setAttribute(){},animate:Element.prototype.animate,remove(){nodes.delete(this);}})};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/button-particles.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Element});
const cleanup=out.installButtonParticles(doc,win),click=doc.events.get('click');
const event={target:new Element(),button:0,detail:1,clientX:25,clientY:30,preventDefault(){throw Error('blocked default');},stopPropagation(){throw Error('blocked handler');}};
click(event);assert.equal(nodes.size,6);assert.equal([...nodes][0].style.left,'25px');
for(let i=0;i<30;i++)click(event);assert.equal(nodes.size,18);assert.equal(timers.size,3);
win.events.get('scroll')();assert.equal(nodes.size,0);assert.equal(timers.size,0);
click({...event,detail:0});assert.equal([...nodes][0].style.left,'60px');
for(const f of [...timers.values()])f();assert.equal(nodes.size,0);
for(const guard of ['disabled','outside','blocked','reduced','hidden']){
 enabled=guard!=='disabled';inside=guard!=='outside';blocked=guard==='blocked';reduced.matches=guard==='reduced';doc.hidden=guard==='hidden';click(event);assert.equal(nodes.size,0,guard);
}
enabled=inside=true;blocked=reduced.matches=doc.hidden=false;fail=true;click(event);assert.equal(nodes.size,0);assert.equal(timers.size,0);fail=false;
click(event);cleanup();assert.equal(nodes.size,0);assert.equal(timers.size,0);for(const e of [doc,win,reduced])assert.equal(e.events.size,0);
console.log('Particle feedback passed: six particles, bounded rapid clicks, keyboard origin, disabled/scope/motion guards, timers/listeners cleanup, decorative error isolation; no interception of business events.');
