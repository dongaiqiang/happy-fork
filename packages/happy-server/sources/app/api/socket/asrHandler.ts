import { Socket } from "socket.io";
import { log } from "@/utils/log";
import crypto from "crypto";
import WebSocket from "ws";

export function asrHandler(userId: string, socket: Socket) {
    let xfWs: WebSocket | null = null;
    let isFirstFrame = true;
    let chunkCount = 0;

    const toBase64Audio = (data: {
        audioBase64?: string;
        chunk?: Buffer | ArrayBuffer | Uint8Array | number[] | { type: "Buffer"; data: number[] };
    }) => {
        if (typeof data.audioBase64 === "string" && data.audioBase64.length > 0) {
            return data.audioBase64;
        }

        const chunk = data.chunk as any;
        if (!chunk) {
            return "";
        }

        if (Buffer.isBuffer(chunk)) {
            return chunk.toString("base64");
        }

        if (chunk instanceof ArrayBuffer) {
            return Buffer.from(new Uint8Array(chunk)).toString("base64");
        }

        if (chunk instanceof Uint8Array) {
            return Buffer.from(chunk).toString("base64");
        }

        if (Array.isArray(chunk)) {
            return Buffer.from(chunk).toString("base64");
        }

        if (chunk.type === "Buffer" && Array.isArray(chunk.data)) {
            return Buffer.from(chunk.data).toString("base64");
        }

        return "";
    };

    // 监听前端发来的 ASR 开始指令
    socket.on("asr_start", async (data: { sessionId: string }) => {
        log({ module: 'asr' }, `[ASR] Start requested by user ${userId} for session ${data?.sessionId}`);
        
        const APPID = process.env.IFLYTEK_APPID;
        const API_SECRET = process.env.IFLYTEK_API_SECRET;
        const API_KEY = process.env.IFLYTEK_API_KEY;

        if (!APPID || !API_SECRET || !API_KEY) {
            socket.emit("asr_error", { message: "后端未配置科大讯飞 API 凭证" });
            return;
        }

        // 清理旧连接
        if (xfWs) {
            xfWs.close();
            xfWs = null;
        }

        isFirstFrame = true;
        chunkCount = 0;

        // 生成鉴权 URL
        const date = new Date().toUTCString();
        const host = "iat-api.xfyun.cn";
        const path = "/v2/iat";
        
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
        const signatureSha = crypto.createHmac('sha256', API_SECRET).update(signatureOrigin).digest('base64');
        const authorizationOrigin = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
        const authStr = Buffer.from(authorizationOrigin).toString('base64');
        
        const wsUrl = `wss://${host}${path}?authorization=${authStr}&date=${encodeURIComponent(date)}&host=${host}`;

        log({ module: 'asr' }, `[ASR] 正在连接科大讯飞...`);
        // 连接科大讯飞
        xfWs = new WebSocket(wsUrl);

        xfWs.on('open', () => {
            log({ module: 'asr' }, `[ASR] 成功连接科大讯飞 WebSocket 服务`);
            socket.emit("asr_ready", { status: "ok", message: "🚀 科大讯飞流式语音识别已就绪！" });
        });

        xfWs.on('message', (data, isBinary) => {
            try {
                const res = JSON.parse(data.toString());
                if (res.code !== 0) {
                    log({ module: 'asr', level: 'error' }, `[ASR] 讯飞返回错误: ${res.code} - ${res.message}`);
                    
                    // 10108 或 invalid handle 是由于引擎触发了静音超时 (vad_eos) 或 达到60秒时长上限，
                    // 引擎主动关闭了会话，但由于网络延迟，后端还在继续向它发送残余的音频帧导致的“句柄无效”。
                    // 这是一个正常的生命周期边缘情况，我们将其当做正常的会话结束处理，不再向前端抛出红色错误。
                    if (res.code === 10108 || (res.message && res.message.toLowerCase().includes("invalid handle"))) {
                        if (xfWs) {
                            xfWs.close();
                            xfWs = null;
                        }
                        socket.emit("asr_end");
                        return;
                    }

                    socket.emit("asr_error", { message: `讯飞识别错误: ${res.message}` });
                    return;
                }

                if (res.data && res.data.result) {
                    const wsResult = res.data.result;
                    let text = "";
                    const ws = wsResult.ws;
                    for (let i = 0; i < ws.length; i++) {
                        const cw = ws[i].cw;
                        for (let j = 0; j < cw.length; j++) {
                            text += cw[j].w;
                        }
                    }
                    
                    if (text) {
                        socket.emit("asr_text", { 
                            text: text, 
                            sn: wsResult.sn,      // 句子序号
                            ls: wsResult.ls,      // 是否最后一片
                            pgs: wsResult.pgs     // pgs: 'rpl' 代表替换前一句话
                        });
                        log({ module: 'asr' }, `[ASR] 讯飞返回 (sn:${wsResult.sn}, pgs:${wsResult.pgs}): ${text}`);
                    }
                }
                
                // 讯飞返回 status 2 说明当前会话已经结束，可能是触发了 vad_eos (静音超时)
                if (res.data && res.data.status === 2) {
                    log({ module: 'asr' }, `[ASR] 讯飞引擎返回 status 2，会话结束`);
                    if (xfWs) {
                        xfWs.close();
                        xfWs = null;
                    }
                    // 通知前端本次识别段落结束
                    socket.emit("asr_end");
                }
            } catch (err) {
                log({ module: 'asr', level: 'error' }, `[ASR] 解析讯飞响应失败: ${err}`);
            }
        });

        xfWs.on('close', () => {
            log({ module: 'asr' }, `[ASR] 讯飞 WebSocket 连接已关闭`);
            xfWs = null;
        });

        xfWs.on('error', (err) => {
            log({ module: 'asr', level: 'error' }, `[ASR] 讯飞 WebSocket 发生错误: ${err}`);
            // 彻底屏蔽底层 ws 抛出的各种 handle 错误
            if (err && err.message && err.message.toLowerCase().includes("invalid handle")) {
                return;
            }
            socket.emit("asr_error", { message: `讯飞网络错误: ${err.message}` });
        });
    });

    // 接收前端发送的 PCM 音频切片 (16kHz, 16bit, mono)
    socket.on("asr_audio_chunk", (data: {
        audioBase64?: string;
        chunk?: Buffer | ArrayBuffer | Uint8Array | number[] | { type: "Buffer"; data: number[] };
        chunkByteLength?: number;
    }) => {
        if (!xfWs || xfWs.readyState !== WebSocket.OPEN) {
            log({ module: 'asr', level: 'warn' }, `[ASR] 收到音频块，但讯飞 WebSocket 未连接！`);
            return;
        }

        const base64Audio = toBase64Audio(data);
        if (!base64Audio) {
            log({ module: 'asr', level: 'warn' }, `[ASR] 收到空音频块，已跳过`);
            return;
        }

        chunkCount += 1;
        if (chunkCount % 50 === 1) {
            log({ module: 'asr' }, `[ASR] 收到前端音频块 #${chunkCount}，大小: ${data.chunkByteLength ?? 0} bytes`);
        }
        const APPID = process.env.IFLYTEK_APPID;

        const reqData: any = {
            data: {
                status: isFirstFrame ? 0 : 1,
                format: "audio/L16;rate=16000",
                encoding: "raw",
                audio: base64Audio
            }
        };

        if (isFirstFrame) {
            reqData.common = { app_id: APPID };
            reqData.business = {
                language: "zh_cn",
                domain: "iat", // 默认为日常用语 iat。可选：medical(医疗), gov(政务) 等。古诗词没有专用领域。
                accent: "mandarin",
                vinfo: 1,
                vad_eos: 10000, // 增加尾端静音超时时间到最大值 (10秒)
                dwa: "wpgs",    // 开启动态修正
                ptt: 0          // 【核心修改】强制关闭标点符号！因为加标点容易让引擎提前判定句子结束并挂断
            };
            isFirstFrame = false;
        }

        try {
            xfWs.send(JSON.stringify(reqData));
        } catch (err) {
            log({ module: 'asr', level: 'error' }, `[ASR] 发送音频数据失败: ${err}`);
        }
    });

    // 接收前端停止录音指令
    socket.on("asr_stop", () => {
        log({ module: 'asr' }, `[ASR] Stop requested by user ${userId}`);
        if (xfWs && xfWs.readyState === WebSocket.OPEN) {
            try {
                // 发送最后一块，状态为 2，告诉讯飞我们说完了
                xfWs.send(JSON.stringify({
                    data: {
                        status: 2,
                        format: "audio/L16;rate=16000",
                        encoding: "raw",
                        audio: ""
                    }
                }));
                
                // 延迟一点点时间后主动关闭连接，防止后续残余数据引发 invalid handle
                setTimeout(() => {
                    if (xfWs) {
                        xfWs.close();
                        xfWs = null;
                    }
                }, 500);
            } catch (err) {
                // ignore
            }
        }
    });
}
