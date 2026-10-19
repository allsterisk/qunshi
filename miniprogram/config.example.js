// Copy to config.js. Replace YOUR_COMPUTER_LAN_IP for same-Wi-Fi phone testing.
const simulatorUrl = 'http://127.0.0.1:8787';
const deviceUrl = 'http://YOUR_COMPUTER_LAN_IP:8787';
const device = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : wx.getSystemInfoSync();
const onPhone = device.platform === 'android' || device.platform === 'ios';
module.exports = { apiBaseUrl: onPhone ? deviceUrl : simulatorUrl };
