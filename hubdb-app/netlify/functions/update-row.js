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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin':  '*',
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

  const token    = process.env.HUBSPOT_TOKEN;
  const TABLE_ID = '198856971';

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HUBSPOT_TOKEN 環境變數未設定' }),
    };
  }

  let rowId, itemNo, itemCategory, itemEvent, itemDate, itemContact;
  try {
    const body   = JSON.parse(event.body || '{}');
    rowId        = body.rowId;
    itemNo       = body.itemNo;
    itemCategory = body.itemCategory;
    itemEvent    = body.itemEvent;
    itemDate     = body.itemDate;
    itemContact  = body.itemContact;
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '無效的請求格式' }),
    };
  }

  if (!rowId || !itemEvent || !itemContact) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '缺少 rowId、活動名稱或聯絡人' }),
    };
  }

  const payload = JSON.stringify({
    values: {
      no:       itemNo       || '',
      category: itemCategory || '其他',
      event:    itemEvent,
      date:     itemDate     || '',
      contact:  itemContact,
    }
  });

  try {
    // Step 1：PATCH draft row（只更新資料欄位，不動 status）
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path:     `/cms/v3/hubdb/tables/${TABLE_ID}/rows/${rowId}/draft`,
      method:   'PATCH',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);

    // Step 2：push-live
    await hubdbRequest({
      hostname: 'api.hubapi.com',
      path:     `/cms/v3/hubdb/tables/${TABLE_ID}/draft/push-live`,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Content-Length': '0',
      },
    }, null);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('Update row error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
