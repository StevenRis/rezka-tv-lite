const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {};
vm.runInNewContext(fs.readFileSync('navigation.js','utf8'), context);
const nav = context.TVNav;
assert.equal(nav.next(0,'right',4,2),1);
assert.equal(nav.next(0,'down',4,2),2);
assert.equal(nav.next(3,'up',4,2),1);
assert.equal(nav.next(0,'left',4,2),0);
assert.equal(nav.next(3,'right',4,2),3);
assert.equal(nav.next(0,'down',4,1),1);
assert.equal(nav.action(461),'back');
assert.equal(nav.action(10009),'back');
assert.equal(nav.action(13),'ok');
assert.equal(nav.action(999), '');
assert.equal(nav.action(999, {999:'up'}),'up');
for (const [code, action] of [[50,'up'],[52,'left'],[53,'ok'],[54,'right'],[56,'down'],[98,'up'],[100,'left'],[101,'ok'],[102,'right'],[104,'down']]) {
  assert.equal(nav.action(code),action);
}
assert.equal(nav.action(50,{50:'left'}),'up');
assert.equal(nav.action(53,{53:'back'}),'ok');
let selected=0;
for (const code of [54,56,52,50]) selected=nav.next(selected,nav.action(code),24,2);
assert.equal(selected,0);
assert.equal(nav.action(8),'back');
console.log('Navigation: 25 checks passed');
