const { decode } = require('base64-arraybuffer');

const b64 = "AFBMQUlOVEVYVDp7InJvbGUiOiJ1c2VyIiwiY29udGVudCI6eyJ0eXBlIjoidGV4dCIsInRleHQiOiLkvaDlpb0ifSwibWV0YSI6fX0=";
// This is not full base64, but let's just make a mock one:
const data = Buffer.from("\x00PLAINTEXT:{\"role\":\"user\",\"content\":{\"type\":\"text\",\"text\":\"你好\"},\"meta\":{}}");

const jsonStr = new TextDecoder().decode(data);
const jsonStartIndex = Math.max(jsonStr.indexOf('{'), jsonStr.indexOf('['));
if (jsonStartIndex !== -1) {
    const cleanJsonStr = jsonStr.substring(jsonStartIndex);
    try {
        const parsed = JSON.parse(cleanJsonStr);
        console.log("Success:", parsed);
    } catch (e) {
        console.log("Failed JSON parse:", e.message);
    }
} else {
    console.log("No { found");
}
