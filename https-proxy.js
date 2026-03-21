const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

// Generate self-signed cert if not exists
if (!fs.existsSync('key.pem') || !fs.existsSync('cert.pem')) {
    console.log('Generating self-signed certificate...');
    exec('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        startProxy();
    });
} else {
    startProxy();
}

function startProxy() {
    const options = {
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    };

    // Proxy for Web (8443 -> 8083)
    https.createServer(options, (req, res) => {
        const proxyReq = http.request({
            hostname: 'localhost',
            port: 8083,
            path: req.url,
            method: req.method,
            headers: req.headers
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        req.pipe(proxyReq);
        
        proxyReq.on('error', (e) => {
            console.error(`Web proxy error: ${e.message}`);
            res.end();
        });
    }).listen(8443, '0.0.0.0', () => {
        console.log('HTTPS Web Proxy listening on https://0.0.0.0:8443 (proxies to :8083)');
    });

    // Proxy for API (3443 -> 3005)
    https.createServer(options, (req, res) => {
        const proxyReq = http.request({
            hostname: 'localhost',
            port: 3005,
            path: req.url,
            method: req.method,
            headers: req.headers
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        req.pipe(proxyReq);

        proxyReq.on('error', (e) => {
            console.error(`API proxy error: ${e.message}`);
            res.end();
        });
    }).listen(3443, '0.0.0.0', () => {
        console.log('HTTPS API Proxy listening on https://0.0.0.0:3443 (proxies to :3005)');
    });
}
