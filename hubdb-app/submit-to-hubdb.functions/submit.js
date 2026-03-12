const https = require('https');

exports.main = async (context, sendResponse) => {
  // 從 Secret 讀取 Token（安全存在伺服器端）
  const token = process.env.HUBSPOT_TOKEN;
  const TABLE_ID = '198856971';

  // 從前端傳來的 body 取得欄位值
  const { itemName } = context.body;

  if (!itemName) {
    sendResponse({ statusCode: 400, body: { error: '請提供 itemName' } });
    return;
  }

  const payload = JSON.stringify({
    values: {
      name: itemName // 確保此欄位名稱與 HubDB 表格的欄位內部名稱一致
    }
  });

  const options = {
    hostname: 'api.hubapi.com',
    path: `/cms/v3/hubdb/tables/${TABLE_ID}/rows`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } else {
            reject(new Error(`HubDB 錯誤 ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    sendResponse({
      statusCode: 200,
      body: { success: true, data: result.body }
    });
  } catch (err) {
    sendResponse({
      statusCode: 500,
      body: { error: err.message }
    });
  }
};

