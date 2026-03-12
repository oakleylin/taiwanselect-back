async function sendData() {
    const statusEl = document.getElementById('status');
    const itemName    = document.getElementById('itemName').value.trim();
    const itemEmail   = document.getElementById('itemEmail').value.trim();
    const itemMessage = document.getElementById('itemMessage').value.trim();

    if (!itemName || !itemEmail || !itemMessage) {
        statusEl.style.color = 'red';
        statusEl.innerText = '❌ 請填寫所有欄位！';
        return;
    }

    statusEl.style.color = 'black';
    statusEl.innerText = '⏳ 正在傳送中...';

    const url = '/.netlify/functions/submit';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemName, itemEmail, itemMessage })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            statusEl.style.color = 'green';
            statusEl.innerText = '✅ 成功！資料已存入 HubDB';
            // 清空表單
            document.getElementById('itemName').value = '';
            document.getElementById('itemEmail').value = '';
            document.getElementById('itemMessage').value = '';
            console.log('HubDB 回傳內容：', result.data);
        } else {
            statusEl.style.color = 'red';
            statusEl.innerText = `❌ 失敗：${result.error || '未知錯誤'}`;
            console.error('錯誤詳情：', result);
        }
    } catch (err) {
        statusEl.style.color = 'red';
        statusEl.innerText = '❌ 連線錯誤，請確認 Netlify 已部署';
        console.error(err);
    }
}
