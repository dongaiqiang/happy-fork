const fs = require('fs');
const token = JSON.parse(fs.readFileSync('/Users/dongaiqiang/.happy/access.key', 'utf8')).token;

async function run() {
    const sessionId = 'cmn1089k70bjj9k7mu7xomnxe';
    const res = await fetch(`http://172.20.10.2:3005/v3/sessions/${sessionId}/messages?after_seq=0&limit=100`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    console.log(res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
