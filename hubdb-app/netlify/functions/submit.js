const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const TABLE_ID = '198856971';
  const token = process.env.HUBSPOT_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HUBSPOT_TOKEN 環境變數未設定' })
    };
  }

  let itemNo, itemCategory, itemEvent, itemDate, itemContact;
  try {
    const body    = JSON.parse(event.body);
    itemNo        = body.itemNo;
    itemCategory  = body.itemCategory;
    itemEvent     = body.itemEvent;
    itemDate      = body.itemDate;
    itemContact   = body.itemContact;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: '無效的請求格式' }) };
  }

  if (!itemEvent || !itemContact) {
    return { statusCode: 400, body: JSON.stringify({ error: '活動名稱與聯絡人為必填欄位' }) };
  }

  const payload = JSON.stringify({
    values: {
      no:       itemNo       || '',
      category: itemCategory || '其他',
      event:    itemEvent,
      date:     itemDate     || '',
      contact:  itemContact,
      status:   'pending'
    }
  });

  const options = {
    hostname: 'api.hubapi.com',
    path: `/cms/v3/hubdb/tables/${TABLE_ID}/rows`,
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
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
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HubDB 錯誤 ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
