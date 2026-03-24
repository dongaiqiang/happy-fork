const fs = require('fs');
const os = require('os');
const path = require('path');
const p = path.join(os.homedir(), '.happy');
['access.key', 'daemon.state.json', 'daemon.state.json.lock', 'settings.json'].forEach(f => {
    try { fs.unlinkSync(path.join(p, f)) } catch(e) {}
});
console.log('Cleared');