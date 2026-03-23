const https = require('https');

https.get('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDNSCY5-Kol7Z-Q87K4elysxiL1eStNoCM', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    try {
        const models = JSON.parse(data).models;
        if(models) {
            console.log(models.map(m => m.name).join('\\n'));
        } else {
             console.log(data);
        }
    } catch(e) { console.log(data); }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
