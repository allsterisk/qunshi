const KEY = 'qunshi.tasks.v1';
const SOURCE_KEY = 'qunshi.sources.v1';

function read() {
  const data = wx.getStorageSync(KEY);
  if (!data) return [];
  if (!Array.isArray(data)) throw new Error('本机待办数据无法读取，请先保留数据并反馈问题。');
  return data;
}

function sources() { return wx.getStorageSync(SOURCE_KEY) || {}; }

function write(tasks) { wx.setStorageSync(KEY, tasks); }

function add(tasks, source) {
  const existing = read();
  const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const allSources = sources();
  // Save images once per import rather than copying them into every task.
  allSources[id] = source;
  wx.setStorageSync(SOURCE_KEY, allSources);
  try {
    write(existing.concat(tasks.map((task, index) => Object.assign({}, task, {
      id: `${id}-${index}`, sourceId: id, done: false, createdAt: new Date().toISOString()
    }))));
  } catch (error) {
    delete allSources[id];
    try { wx.setStorageSync(SOURCE_KEY, allSources); } catch (_) { /* original error takes priority */ }
    throw error;
  }
}

function update(id, patch) {
  const tasks = read();
  if (!tasks.some(task => task.id === id)) throw new Error('待办不存在，请刷新列表。');
  write(tasks.map(task => task.id === id ? Object.assign({}, task, patch, { id: task.id }) : task));
}

function remove(id) {
  const remaining = read().filter(task => task.id !== id);
  write(remaining);
  // Keep source metadata until a future import cleanup; image files may be shared.
}

module.exports = { read, add, update, remove, sources };
