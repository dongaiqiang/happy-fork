const b64 = "AFBMQUlOVEVYVDp7InJvbGUiOiJ1c2VyIiwiY29udGVudCI6eyJ0eXBlIjoidGV4dCIsInRleHQiOiLkvaDlpb3vvIzov5nmmK/m";
// Create proper mock data
const plaintextBytes = new TextEncoder().encode(`PLAINTEXT:{"role":"user","content":{"type":"text","text":"你好，这是测试"}}`);
const data = new Uint8Array(plaintextBytes.length + 1);
data[0] = 0;
data.set(plaintextBytes, 1);

// Now run the EXACT decrypt code from the daemon
const isPlaintextMode = false; // or true if env var is true

  if (isPlaintextMode) {
      try {
          const jsonStr = new TextDecoder().decode(data);
          const jsonStartIndex = Math.max(jsonStr.indexOf('{'), jsonStr.indexOf('['));
          if (jsonStartIndex !== -1) {
              const cleanJsonStr = jsonStr.substring(jsonStartIndex);
              console.log("Plaintext Mode Parsed:", JSON.parse(cleanJsonStr));
              process.exit(0);
          }
      } catch (e) {
          console.log("Plaintext mode parse error:", e);
      }
  }

  // Also check if data starts with "PLAINTEXT:" (which is 10 bytes) for older mode support
  if (data.length > 10) {
    const prefix = new TextDecoder().decode(data.slice(0, 10));
    if (prefix === 'PLAINTEXT:') {
      try {
        const jsonStr = new TextDecoder().decode(data.slice(10));
        console.log("Legacy PLAINTEXT parsed:", JSON.parse(jsonStr));
        process.exit(0);
      } catch (e) {
        console.error('Failed to parse plaintext payload', e);
      }
    }
    
    // Web app often sends data with a null byte prefix for versioning (\x00PLAINTEXT:...)
    if (data[0] === 0 && data.length > 11) {
        const prefixWithNull = new TextDecoder().decode(data.slice(1, 11));
        if (prefixWithNull === 'PLAINTEXT:') {
            try {
                const jsonStr = new TextDecoder().decode(data.slice(11));
                console.log("Legacy NULL+PLAINTEXT parsed:", JSON.parse(jsonStr));
                process.exit(0);
            } catch (e) {
                console.error('Failed to parse plaintext payload with null byte', e);
            }
        }
    }
  }

console.log("Failed all!");
