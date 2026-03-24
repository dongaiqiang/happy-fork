import websocket
import json
import pyaudio
import threading
import time
import os
import uuid
import struct
import gzip
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '../../packages/happy-server/.env.dev')
load_dotenv(env_path)

APP_ID = os.getenv("VOLC_ASR_APPID", "")
ACCESS_KEY = os.getenv("VOLC_ASR_X_API_KEY", "") 

# 根据截图，虽然勾选了“豆包流式语音识别模型2.0”，但该应用下可能没有给该资源授予 Token 权限，
# 或者真正有权限的是第三个勾选的“豆包端到端实时语音大模型”。
# 我们尝试使用端到端大模型的 Resource ID
RESOURCE_ID = "volc.ioasr.sauc.duration"

CHUNK = 3200 
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000

p = pyaudio.PyAudio()
stream = p.open(format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK)

def generate_ws_frame(message_type, payload_bytes, sequence=None):
    """
    根据火山引擎 ASR V2 官方协议：
    Header (4 bytes) + [Sequence (4 bytes)] + Payload Size (4 bytes, Int32) + Payload
    
    Message Type:
    0x1: full client request
    0x2: audio only request
    """
    header = bytearray(4)
    header[0] = 0x11 # version=1, header_size=1
    
    msg_type_bits = message_type << 4
    flags_bits = 0x00
    
    if message_type == 0x2: # AudioOnly
        if sequence is not None:
            if sequence < 0: # 负包 (结束帧)
                flags_bits = 0x03 # 0b0011 (带sequence且为负)
            else:
                flags_bits = 0x01 # 0b0001 (带sequence且为正)
                
    header[1] = msg_type_bits | flags_bits
    
    if message_type == 0x1: # fullclient (JSON + Gzip)
        header[2] = 0x11
        compressed_payload = gzip.compress(payload_bytes)
    elif message_type == 0x2: # AudioOnly (Raw + 无压缩)
        header[2] = 0x00
        compressed_payload = payload_bytes
    else:
        header[2] = 0x00
        compressed_payload = payload_bytes
        
    header[3] = 0x00
    
    packet = bytes(header)
    
    # 追加 Sequence (4字节，如果有的话)
    if (flags_bits & 0x01) or (flags_bits & 0x02):
        packet += struct.pack(">i", sequence)
        
    # 追加 payload size (4字节大端，值为压缩后的 payload 长度)
    payload_size = len(compressed_payload)
    packet += struct.pack(">I", payload_size)
    
    # 追加 payload
    packet += compressed_payload
    
    return packet

# 定义websocket回调函数 
def on_message(ws, message):
    if isinstance(message, bytes):
        try:
            # 协议：Header (4 bytes) + Optional Sequence (4 bytes) + Payload Size (4 bytes) + Payload
            if len(message) < 8:
                return
                
            header = message[:4]
            message_type = header[1] >> 4
            message_type_specific_flags = header[1] & 0x0f
            message_serialization = header[2] >> 4
            message_compression = header[2] & 0x0f
            
            # 如果是服务端的错误帧 (0xf)
            if message_type == 0xf:
                offset = 4
                if message_type_specific_flags in [1, 2, 3]:
                    offset += 4
                payload_size = struct.unpack(">I", message[offset:offset+4])[0]
                offset += 4
                payload = message[offset:offset+payload_size]
                if message_compression == 1:
                    payload = gzip.decompress(payload)
                print(f"❌ 服务端返回错误帧: {payload.decode('utf-8')}")
                return
            
            offset = 4
            if message_type_specific_flags in [1, 2, 3]:
                offset += 4 # 跳过 sequence
                
            payload_size = struct.unpack(">I", message[offset:offset+4])[0]
            offset += 4
            
            payload = message[offset:offset+payload_size]
            
            if message_compression == 1:
                payload = gzip.decompress(payload)
                
            resp = json.loads(payload.decode('utf-8'))
            if resp.get("payload_msg") and resp["payload_msg"].get("result"):
                print("实时识别结果：", resp["payload_msg"]["result"]["text"])
            elif resp.get("payload_msg") and resp["payload_msg"].get("message"):
                print("状态：", resp["payload_msg"]["message"])
            else:
                print("收到数据：", resp)
        except Exception as e:
            print("解析二进制消息失败：", e)
    else:
        try:
            resp = json.loads(message)
            print("文本消息：", resp)
        except:
            print("收到未知消息：", message)

def on_error(ws, error):
    print("WebSocket 错误：", error)

def on_close(ws, close_status_code, close_msg):
    print(f"连接关闭: {close_status_code} - {close_msg}")

def on_open(ws):
    print("✅ WebSocket 连接成功！")
    
    init_frame = {
        "user": {
            "uid": "test_user"
        },
        "audio": {
            "format": "pcm",
            "rate": 16000,
            "bits": 16,
            "channel": 1,
            "codec": "raw"
        },
        "request": {
            "reqid": str(uuid.uuid4()),
            "workflow": "audio_in,res_asr,audio_out",
            "sequence": 1,
            "asr": {"show_utterances": True}
        }
    }
    print("发送握手包：", init_frame)
    # message_type=1 (0x1) 表示 full client request
    ws.send(generate_ws_frame(0x1, json.dumps(init_frame).encode('utf-8')), websocket.ABNF.OPCODE_BINARY)
    
    def send_audio():
        try:
            print("🎙️ 开始实时语音录入（按Ctrl+C停止）...")
            seq = 1
            while True:
                data = stream.read(CHUNK)
                # message_type=2 (0x2) 表示 audio only request, 携带正数 sequence
                ws.send(generate_ws_frame(0x2, data, sequence=seq), websocket.ABNF.OPCODE_BINARY)
                seq += 1
        except KeyboardInterrupt:
            print("\n🛑 停止录音，发送结束帧")
            # 负包表示最后一包，sequence 为负数
            ws.send(generate_ws_frame(0x2, b'', sequence=-seq), websocket.ABNF.OPCODE_BINARY)
            time.sleep(1)
            stream.stop_stream()
            stream.close()
            p.terminate()
            ws.close()
            print("识别结束")
        except Exception as e:
            print(f"发送音频时发生异常: {e}")

    threading.Thread(target=send_audio).start()

if __name__ == "__main__":
    print(f"使用配置:\nAPP_ID={APP_ID}\nAPI_KEY={ACCESS_KEY}")
    
    # 【最新官方文档】流式语音识别服务 (ASR) 双向流式模式使用的接口地址
    ws_url = f"wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"
    print(f"\n正在连接 URL: {ws_url}\n")

    # 【最新官方文档】要求的鉴权 Header
    # 注意：官方文档明确给出 Header 是 X-Api-App-Key 和 X-Api-Access-Key，且不需要 Bearer 前缀
    headers = [
        f"X-Api-App-Key: {APP_ID}",
        f"X-Api-Access-Key: {ACCESS_KEY}",
        f"X-Api-Resource-Id: {RESOURCE_ID}",
        f"X-Api-Connect-Id: {str(uuid.uuid4())}"
    ]

    ws = websocket.WebSocketApp(
        ws_url,
        header=headers,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    ws.on_open = on_open
    ws.run_forever()