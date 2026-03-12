const https = require('https');

exports.handler = async () => {
  const token = process.env.HUBSPOT_TOKEN;
  const TABLE_ID = '198856971';

  const options = {
    hostname: 'api.hubapi.com',
    // 使用 /rows/draft 端點，讀取含草稿在內的所有列（包含剛新增、status=pending 的資料）
    path: `/cms/v3/hubdb/tables/${TABLE_ID}/rows/draft?limit=100`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HubDB 錯誤 ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, rows: result.results })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};



