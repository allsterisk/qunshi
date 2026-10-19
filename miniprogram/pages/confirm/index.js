const storage = require('../../utils/storage');
const { validDate } = require('../../utils/date');

function persistImage(tempFilePath) {
  return new Promise((resolve, reject) => {
    const suffix = (tempFilePath.match(/\.(png|jpe?g|webp)$/i) || [])[0] || '.img';
    const savedFilePath = `${wx.env.USER_DATA_PATH}/qunshi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${suffix}`;
    // Copy rather than move: a failed later save must leave the original draft retryable.
    wx.getFileSystemManager().copyFile({ srcPath: tempFilePath, destPath: savedFilePath,
      success: () => resolve(savedFilePath),
      fail: () => reject(new Error('截图保存失败，可能是本机空间不足。待办尚未保存，请重试。')) });
  });
}

Page({
  data: { tasks: [], selectedCount: 0, notice: '', mode: '', sourceText: '', images: [], busy: false, error: '', editing: false },
  onLoad(options) {
    try {
      if (options.id) {
        const task = storage.read().find(item => item.id === options.id);
        if (!task) throw new Error('这条待办已不存在，请返回列表。');
        this.editId = task.id;
        const source = storage.sources()[task.sourceId] || {};
        this.setData({ editing: true, tasks: [Object.assign({}, task, { selected: true })], selectedCount: 1,
          sourceText: source.text || '', images: source.images || [], notice: '编辑已保存的待办，确认后更新。', mode: source.mode || '' });
        wx.setNavigationBarTitle({ title: '编辑待办' });
      } else {
        const draft = getApp().globalData.draft;
        if (!draft) throw new Error('没有待确认的内容，请返回导入通知。');
        this.setData({ tasks: draft.tasks.map(task => Object.assign({}, task, { materialsText: (task.materials || []).join('、') })),
          selectedCount: draft.tasks.length, notice: draft.notice, mode: draft.mode, sourceText: draft.sourceText, images: draft.images || [] });
      }
      this.setData({ tasks: this.data.tasks.map(task => Object.assign({}, task, { materialsText: (task.materials || []).join('、') })) });
    } catch (error) { this.setData({ error: error.message }); }
  },
  fieldChanged(event) {
    if (this.data.busy) return;
    const { index, field } = event.currentTarget.dataset;
    if (!['title', 'dueDate', 'dueTime', 'location', 'materialsText', 'notes'].includes(field)) return;
    this.setData({ [`tasks[${Number(index)}].${field}`]: event.detail.value });
  },
  clearDate(event) {
    if (this.data.busy) return;
    const i = Number(event.currentTarget.dataset.index);
    this.setData({ [`tasks[${i}].dueDate`]: '', [`tasks[${i}].dueTime`]: '' });
  },
  clearTime(event) {
    if (!this.data.busy) this.setData({ [`tasks[${Number(event.currentTarget.dataset.index)}].dueTime`]: '' });
  },
  toggle(event) {
    if (this.data.busy) return;
    const index = Number(event.currentTarget.dataset.index);
    const tasks = this.data.tasks.map((task, i) => i === index ? Object.assign({}, task, { selected: !task.selected }) : task);
    this.setData({ tasks, selectedCount: tasks.filter(task => task.selected).length });
  },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.path, urls: this.data.images }); },
  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/import/index' });
  },
  async save() {
    if (this.data.busy || !this.data.selectedCount) return;
    const selected = this.data.tasks.filter(task => task.selected);
    if (selected.some(task => !task.title.trim())) return this.setData({ error: '请为每条选中的待办填写标题。' });
    if (selected.some(task => task.dueDate && !validDate(task.dueDate))) return this.setData({ error: '日期格式不正确，请重新选择日期。' });
    this.setData({ busy: true, error: '' });
    let savedImages = [];
    try {
      const tasks = selected.map(task => {
        const result = Object.assign({}, task, { title: task.title.trim(), materials: task.materialsText.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean) });
        delete result.materialsText;
        return result;
      });
      if (this.editId) {
        storage.update(this.editId, tasks[0]);
      } else {
        // Save sequentially so a later failure can clean up all earlier files.
        for (const path of this.data.images) savedImages.push(await persistImage(path));
        storage.add(tasks, { text: this.data.sourceText, images: savedImages, mode: this.data.mode });
        getApp().globalData.draft = null;
      }
    } catch (error) {
      savedImages.forEach(filePath => wx.getFileSystemManager().unlink({ filePath, fail() {} }));
      this.setData({ busy: false, error: error.message || '保存失败，请检查本机存储空间后重试。' });
      return;
    }
    this.setData({ busy: false });
    wx.showToast({ title: this.editId ? '已更新' : '已保存', icon: 'success' });
    // Persistence succeeded even if the next page cannot open; disable repeat saves.
    this.setData({ selectedCount: 0 });
    wx.redirectTo({ url: '/pages/tasks/index', fail: () => wx.reLaunch({ url: '/pages/tasks/index' }) });
  }
});
