const assert = require('node:assert/strict');
let pageConfig;
let data = {};
let redirected = '';
const app = { globalData: { draft: { mode: 'rules', notice: '规则体验', sourceText: '请提交报名表', images: [], tasks: [
  { id: 'draft-0', title: '提交报名表', dueDate: '', dueTime: '', materials: ['个人简介'], selected: true, warnings: [] }
] } } };
global.getApp = () => app;
global.Page = config => { pageConfig = config; };
global.wx = {
  getStorageSync: key => structuredClone(data[key]),
  setStorageSync: (key, value) => { data[key] = structuredClone(value); },
  showToast() {}, setNavigationBarTitle() {},
  redirectTo: ({url}) => { redirected = url; }, reLaunch() {}, removeSavedFile() {}
};
const storage = require('../miniprogram/utils/storage');
function loadPage(path) {
  delete require.cache[require.resolve(path)];
  require(path);
  const page = Object.assign({}, pageConfig, { data: structuredClone(pageConfig.data) });
  page.setData = patch => {
    for (const [key, value] of Object.entries(patch)) {
      const nested = key.match(/^tasks\[(\d+)\]\.(\w+)$/);
      if (nested) page.data.tasks[Number(nested[1])][nested[2]] = value;
      else page.data[key] = value;
    }
  };
  return page;
}
(async () => {
  const confirm = loadPage('../miniprogram/pages/confirm/index');
  confirm.onLoad({});
  assert.equal(confirm.data.selectedCount, 1);
  confirm.fieldChanged({ currentTarget: { dataset: { index: 0, field: 'title' } }, detail: { value: '' } });
  await confirm.save();
  assert.match(confirm.data.error, /标题/);
  assert.equal(storage.read().length, 0);
  confirm.fieldChanged({ currentTarget: { dataset: { index: 0, field: 'title' } }, detail: { value: '提交项目报名表' } });
  await confirm.save();
  assert.equal(storage.read()[0].title, '提交项目报名表');
  assert.equal(app.globalData.draft, null);
  assert.equal(redirected, '/pages/tasks/index');
  await confirm.save();
  assert.equal(storage.read().length, 1, 'repeat save must not duplicate');

  const tasks = loadPage('../miniprogram/pages/tasks/index');
  tasks.onShow();
  assert.equal(tasks.data.pending, 1);
  tasks.toggle({ currentTarget: { dataset: { id: storage.read()[0].id } } });
  assert.equal(tasks.data.pending, 0);
  tasks.setFilter({ currentTarget: { dataset: { filter: 'done' } } });
  assert.equal(tasks.data.tasks.length, 1);
  tasks.showSource({ currentTarget: { dataset: { id: storage.read()[0].id } } });
  assert.equal(tasks.data.source.text, '请提交报名表');
  console.log('Pages: confirm validation > save > no duplicate > complete > source passed.');

  // Screenshot sources remain retryable after a partial copy or storage failure.
  const originalFiles = new Set(['tmp-first.png', 'tmp-second.png']);
  const durableFiles = new Set();
  let copyCalls = 0;
  let failSecondCopy = true;
  let failStorage = false;
  wx.env = { USER_DATA_PATH: '/user' };
  wx.getFileSystemManager = () => ({
    copyFile: ({srcPath, destPath, success, fail}) => {
      assert(originalFiles.has(srcPath), 'retry must still have original screenshot');
      copyCalls += 1;
      if (failSecondCopy && copyCalls === 2) return fail();
      durableFiles.add(destPath);
      success();
    },
    unlink: ({filePath}) => durableFiles.delete(filePath)
  });
  wx.setStorageSync = (key, value) => {
    if (failStorage && key === 'qunshi.tasks.v1') throw new Error('quota');
    data[key] = structuredClone(value);
  };
  app.globalData.draft = { mode: 'ai', sourceText: '', images: [...originalFiles], tasks: [
    { id: 'screenshot-draft', title: '截图待办', materials: [], selected: true, warnings: [] }
  ] };
  const screenshotConfirm = loadPage('../miniprogram/pages/confirm/index');
  screenshotConfirm.onLoad({});
  await screenshotConfirm.save();
  assert.match(screenshotConfirm.data.error, /截图保存失败/);
  assert.equal(originalFiles.size, 2);
  assert.equal(durableFiles.size, 0);
  failSecondCopy = false;
  failStorage = true;
  await screenshotConfirm.save();
  assert.equal(durableFiles.size, 0, 'failed commit must clean copies');
  assert.equal(originalFiles.size, 2);
  failStorage = false;
  await screenshotConfirm.save();
  assert.equal(durableFiles.size, 2);
  assert.equal(storage.read().length, 2);
  console.log('Screenshots: partial copy failure > storage failure > successful retry passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
