const assert = require('node:assert/strict');
let state = {};
let failTasks = false;
global.wx = {
  getStorageSync: key => structuredClone(state[key]),
  setStorageSync: (key, value) => {
    if (failTasks && key === 'qunshi.tasks.v1') throw new Error('quota');
    state[key] = structuredClone(value);
  }
};
const storage = require('../miniprogram/utils/storage');
assert.deepEqual(storage.read(), []);
storage.add([{ title: '提交报名表', materials: ['个人简介'] }], { text: '通知', images: [] });
let [task] = storage.read();
assert.equal(task.done, false);
assert.equal(storage.sources()[task.sourceId].text, '通知');
storage.update(task.id, { done: true });
assert.equal(storage.read()[0].done, true);
storage.update(task.id, { title: '新标题' });
assert.equal(storage.read()[0].title, '新标题');
const sourceCount = Object.keys(storage.sources()).length;
failTasks = true;
assert.throws(() => storage.add([{ title: '不应保存' }], { text: '新通知' }), /quota/);
assert.equal(storage.read().length, 1);
assert.equal(Object.keys(storage.sources()).length, sourceCount);
failTasks = false;
storage.remove(task.id);
assert.equal(storage.read().length, 0);
console.log('Storage: CRUD and failed-save rollback passed.');
