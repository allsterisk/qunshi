const { apiBaseUrl } = require('../config');
function extract(payload) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}/api/extract`, method: 'POST', data: payload, timeout: 85000,
      header: { 'content-type': 'application/json' },
      success(response) {
        if (response.statusCode !== 200) return reject(new Error(response.data.error || '整理失败，请重试。'));
        if (!response.data || !Array.isArray(response.data.tasks)) return reject(new Error('服务返回格式不正确。'));
        resolve(response.data);
      },
      fail(error) {
        const message = error.errMsg || '';
        if (/domain list|合法域名/i.test(message)) {
          return reject(new Error('微信拦截了调试地址。请在手机右上角菜单中打开调试，重新进入后再试；正式版需配置 HTTPS 合法域名。'));
        }
        reject(new Error(`连接不到整理服务（${apiBaseUrl}）。请确认后端已启动，手机与电脑连接同一 Wi-Fi；也可用手机浏览器打开此地址后的 /health 检查连通性。`));
      }
    });
  });
}
module.exports = { extract };
