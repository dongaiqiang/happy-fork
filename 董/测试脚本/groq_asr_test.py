import os
from groq import Groq

# ------------------------------------------------------------------
# Groq Whisper ASR 极简测试脚本
# 没有什么 AK/SK，没有签名，没有复杂的 WebSocket，没有恶心的 Resource ID。
# 只需要去 https://console.groq.com/ 免费注册并生成一个 API Key。
# ------------------------------------------------------------------

# 替换为你免费申请的 GROQ API KEY
GROQ_API_KEY = "gsk_xxxxxxx你的真实Keyxxxxxxx"

def test_groq_asr():
    print("🚀 初始化 Groq 客户端...")
    client = Groq(api_key=GROQ_API_KEY)
    
    # 这里假设我们有一段测试录音 test_audio.m4a (你可以用手机随便录一段)
    # 在实际的流式应用中，我们可以让前端每录制 2秒钟，就通过 HTTP 发送过来一次。
    # 因为 Groq 的处理速度是“毫秒级”的，所以虽然是 HTTP，体验上完全等同于“边说边出字”。
    
    test_file = "test_audio.m4a"
    
    if not os.path.exists(test_file):
        print(f"❌ 找不到测试音频文件: {test_file}")
        print("请在当前目录放一个测试音频（wav/m4a/mp3都可以），然后重新运行。")
        return

    print(f"上传音频 {test_file} 进行识别...")
    
    with open(test_file, "rb") as file:
        # 极简的 API 调用，就跟调用 ChatGPT 一模一样
        transcription = client.audio.transcriptions.create(
          file=(test_file, file.read()),
          model="whisper-large-v3", # 目前最强的开源多语言语音模型
          prompt="这是一段中文语音测试",  # 可选，给模型一点上下文提示
          response_format="json",  
          language="zh",  # 指定中文
        )
        
        print("\n✅ 识别成功！结果如下：")
        print("-" * 50)
        print(transcription.text)
        print("-" * 50)

if __name__ == "__main__":
    test_groq_asr()