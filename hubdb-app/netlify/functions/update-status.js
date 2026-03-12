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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const token = process.env.HUBSPOT_TOKEN;
  const TABLE_ID = '198856971';

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HUBSPOT_TOKEN 環境變數未設定' })
    };
  }

  const { rowId, status } = JSON.parse(event.body);

  if (!rowId || !status) {
    return { statusCode: 400, body: JSON.stringify({ error: '缺少 rowId 或 status' }) };
  }

  const payload = JSON.stringify({ values: { status } });

  try {
    // Step 1: 更新 draft row
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${TABLE_ID}/rows/${rowId}/draft`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    // Step 2: 發布變更到 live
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${TABLE_ID}/draft/push-live`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': '0'
      }
    }, null);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Update status error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

