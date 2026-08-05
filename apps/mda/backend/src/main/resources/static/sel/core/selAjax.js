(function (global) {
  'use strict';

  async function request(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error('服务返回了无法解析的 JSON。');
    }
    if (!response.ok || payload.success === false) {
      throw new Error(payload.msg || ('请求失败：HTTP ' + response.status));
    }
    return payload;
  }

  global.selAjax = {
    get: function (url) {
      return request(url, { headers: { Accept: 'application/json' } });
    },
    post: function (url, body) {
      return request(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
    }
  };
})(window);
