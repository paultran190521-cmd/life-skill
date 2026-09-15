const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real component event handlers without network/database writes.
const source = fs.readFileSync('components/lesson-plan-link-form.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function mount(props) {
  const slots = []; let cursor = 0;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    };
    return require(name);
  }});
  return () => { cursor = 0; return exports.LessonPlanLinkForm(props); };
}
async function main() {
  const drafts = { current: {} };
  let calls = 0, resolveSave;
  const props = { draftKey: 'teacher1:s1', drafts, busy: false, onSave: () => { calls++; return new Promise(resolve => { resolveSave = resolve; }); } };
  let render = mount(props);
  let tree = render();
  tree.props.children[0].props.onChange({ target: { value: 'https://example.test/plan' } });
  assert.equal(drafts.current['teacher1:s1'], 'https://example.test/plan');
  render = mount(props); // page/menu return restores the draft
  assert.equal(render().props.children[0].props.value, 'https://example.test/plan');
  assert.equal(mount({ ...props, draftKey: 'teacher2:s1' })().props.children[0].props.value, '');
  const click = render().props.children[1].props.onClick;
  click(); click();
  assert.equal(calls, 1, 'double-click cannot submit twice');
  assert.equal(render().props.children[0].props.disabled, true);
  resolveSave(false); await new Promise(setImmediate);
  assert.equal(render().props.children[0].props.value, 'https://example.test/plan', 'failure retains draft');
  render().props.children[1].props.onClick();
  resolveSave(true); await new Promise(setImmediate);
  assert.equal(render().props.children[0].props.value, '');
  assert.equal(drafts.current['teacher1:s1'], undefined);
  props.busy = true;
  render().props.children[1].props.onClick();
  assert.equal(calls, 2, 'busy blocks save');
  console.log('Link form passed: draft restore, account isolation, failed/successful save, duplicate/busy guards. No writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
