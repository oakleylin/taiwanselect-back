const https = require('https');

function hubdbRequest(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HubDB 錯誤 ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  // 處理預檢請求（瀏覽器的 OPTIONS）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const token = process.env.HUBSPOT_TOKEN;
  const TABLE_ID = '198856971';

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HUBSPOT_TOKEN 環境變數未設定' }),
    };
  }

  let rowId;
  try {
    const body = JSON.parse(event.body || '{}');
    rowId = body.rowId;
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '無效的請求格式' }),
    };
  }

  if (!rowId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '缺少 rowId' }),
    };
  }

  try {
    // Step 1：刪除該列（draft）
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${TABLE_ID}/rows/${rowId}/draft`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, null);

    // Step 2：將變更推到 live
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${TABLE_ID}/draft/push-live`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': '0',
      },
    }, null);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('Delete row error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

