const api = require('../../utils/api');
const storage = require('../../utils/storage');
const fs = wx.getFileSystemManager();

const SAMPLE = '【演示素材 · 班级群】\n请报名参加校园创意赛，2026年10月25日18:00前提交报名表，材料为个人简介和项目说明。\n参加说明会的同学请于2026年10月23日14:00到图书馆报告厅签到。\n周五前提交志愿者申请，具体截止日期请与班长确认。';

function readImage(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile({ filePath, encoding: 'base64', success: result => resolve(result.data), fail: () => reject(new Error('截图读取失败，请重新选择。')) });
  });
}

Page({
  data: { text: '', images: [], referenceDate: '', busy: false, error: '', taskCount: 0, consent: false },
  onShow() {
    try { this.setData({ taskCount: storage.read().filter(task => !task.done).length }); }
    catch (error) { this.setData({ error: error.message }); }
  },
  onText(event) { this.setData({ text: event.detail.value }); },
  setReference(event) { this.setData({ referenceDate: event.detail.value }); },
  clearReference() { this.setData({ referenceDate: '' }); },
  consentChanged(event) { this.setData({ consent: event.detail.value.includes('agree') }); },
  useSample() { if (!this.data.busy) this.setData({ text: SAMPLE, error: '' }); },
  async paste() {
    if (this.data.busy) return;
    wx.getClipboardData({ success: result => this.setData({ text: result.data.slice(0, 20000), error: '' }), fail: () => this.setData({ error: '未能读取剪贴板，请手动粘贴。' }) });
  },
  chooseImages() {
    if (this.data.busy || this.data.images.length >= 4) return;
    wx.chooseMedia({
      count: 4 - this.data.images.length, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
      success: result => {
        const accepted = result.tempFiles.filter(file => file.size <= 2 * 1024 * 1024);
        this.setData({ images: this.data.images.concat(accepted.map(file => ({ path: file.tempFilePath }))), error: accepted.length < result.tempFiles.length ? '部分图片超过 2MB，请压缩后重新选择。' : '' });
      },
      fail: error => { if (!/cancel/.test(error.errMsg)) this.setData({ error: '无法打开相册，请检查图片访问权限。' }); }
    });
  },
  removeImage(event) {
    if (this.data.busy) return;
    this.setData({ images: this.data.images.filter((_, i) => i !== Number(event.currentTarget.dataset.index)) });
  },
  previewImage(event) { wx.previewImage({ current: event.currentTarget.dataset.path, urls: this.data.images.map(image => image.path) }); },
  openTasks() { wx.navigateTo({ url: '/pages/tasks/index' }); },
  async submit() {
    if (this.data.busy) return;
    if (!this.data.text.trim() && !this.data.images.length) return this.setData({ error: '先粘贴通知文字，或选择至少一张截图。' });
    if (!this.data.consent) return this.setData({ error: '请先确认下方的通知处理说明。' });
    this.setData({ busy: true, error: '' });
    try {
      const images = await Promise.all(this.data.images.map(async image => {
        const data = await readImage(image.path);
        const mime = data.startsWith('iVBOR') ? 'image/png' : data.startsWith('/9j/') ? 'image/jpeg' : data.startsWith('UklGR') ? 'image/webp' : '';
        if (!mime) throw new Error('暂时只支持 JPG、PNG 和 WebP，请转换图片后重试。');
        return { mime, data };
      }));
      const result = await api.extract({ text: this.data.text, images, referenceDate: this.data.referenceDate });
      getApp().globalData.draft = Object.assign({}, result, {
        images: this.data.images.map(image => image.path), referenceDate: this.data.referenceDate
      });
      wx.navigateTo({ url: '/pages/confirm/index' });
    } catch (error) { this.setData({ error: error.message || '整理失败，请重试。' }); }
    finally { this.setData({ busy: false }); }
  }
});
