const storage = require('../../utils/storage');
const { today, label } = require('../../utils/date');

Page({
  data: { tasks: [], filter: 'pending', pending: 0, completed: 0, error: '', source: null },
  onShow() { this.refresh(); },
  refresh() {
    try {
      const all = storage.read();
      const date = today();
      const tasks = all.filter(task => this.data.filter === 'done' ? task.done : !task.done)
        .sort((a, b) => `${a.dueDate || '9999'} ${a.dueTime || '23:59'}`.localeCompare(`${b.dueDate || '9999'} ${b.dueTime || '23:59'}`))
        .map(task => Object.assign({}, task, { dateLabel: label(task), overdue: !task.done && !!task.dueDate && task.dueDate < date,
          materialsText: (task.materials || []).join('、') }));
      this.setData({ tasks, pending: all.filter(task => !task.done).length, completed: all.filter(task => task.done).length, error: '' });
    } catch (error) { this.setData({ error: error.message || '读取失败，请重新进入页面。' }); }
  },
  setFilter(event) { this.setData({ filter: event.currentTarget.dataset.filter }); this.refresh(); },
  toggle(event) {
    try {
      const task = this.data.tasks.find(item => item.id === event.currentTarget.dataset.id);
      if (!task) return;
      storage.update(task.id, { done: !task.done });
      this.refresh();
    } catch (error) { this.setData({ error: error.message || '更新失败，请检查本机存储空间。' }); }
  },
  edit(event) { wx.navigateTo({ url: '/pages/confirm/index?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  remove(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({ title: '删除这条待办？', content: '删除后无法恢复，其他待办不受影响。', confirmText: '删除', confirmColor: '#ab2935',
      success: result => {
        if (!result.confirm) return;
        try { storage.remove(id); this.refresh(); } catch (error) { this.setData({ error: error.message || '删除失败，请重试。' }); }
      }
    });
  },
  showSource(event) {
    try {
      const task = this.data.tasks.find(item => item.id === event.currentTarget.dataset.id);
      const source = storage.sources()[task.sourceId];
      this.setData({ source: Object.assign({ text: task.sourceQuote || '没有保存通知文字。', images: [] }, source || {}, { title: task.title }) });
    } catch (_) { this.setData({ error: '原文读取失败，请重试。' }); }
  },
  closeSource() { this.setData({ source: null }); },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.path, urls: this.data.source.images }); },
  importMore() { wx.reLaunch({ url: '/pages/import/index' }); }
});
