import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { apiSocket } from '@/sync/apiSocket';
import { requestMicrophonePermission, showMicrophonePermissionDeniedAlert } from '@/utils/microphonePermissions';

interface UseCustomASRProps {
    onTextUpdate?: (text: string) => void;
    sessionId?: string;
}

export function useCustomASR({ onTextUpdate, sessionId }: UseCustomASRProps) {
    const [isListening, setIsListening] = useState(false);
    
    // Web Audio API refs
    const audioContextRef = useRef<any>(null);
    const mediaStreamSourceRef = useRef<any>(null);
    const scriptProcessorRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunkCountRef = useRef<number>(0);
    
    // React Native Audio API refs
    const nativeRecorderRef = useRef<any>(null);

    const resultTextArrayRef = useRef<string[]>([]);

    useEffect(() => {
        const cleanupText = apiSocket.onMessage('asr_text', (data: any) => {
            console.log('[ASR Frontend] 收到后端发来的 asr_text:', data);
            if (data && data.text) {
                if (data.pgs === 'rpl') {
                    // 动态修正：替换最后一个片段
                    resultTextArrayRef.current.pop();
                }
                resultTextArrayRef.current.push(data.text);
                
                const joinedText = resultTextArrayRef.current.join('');
                console.log(`[ASR Frontend] 准备调用 onTextUpdate, 拼接后的文本: "${joinedText}", onTextUpdate 是否存在: ${!!onTextUpdate}`);
                if (onTextUpdate) {
                    onTextUpdate(joinedText);
                }
            }
        });
        
        const cleanupEnd = apiSocket.onMessage('asr_end', () => {
            console.log('[ASR Frontend] 收到后端发来的 asr_end，停止录音');
            stopListening();
        });
        
        const cleanupError = apiSocket.onMessage('asr_error', (err: any) => {
            console.error('[ASR Frontend] 收到后端发来的 asr_error:', err);
            stopListening();
        });

        return () => { 
            cleanupText(); 
            cleanupEnd();
            cleanupError();
        };
    }, [onTextUpdate]);

    const stopListening = useCallback(() => {
        console.log('[ASR Frontend] stopListening() 被调用，准备清理资源');
        setIsListening(false);
        chunkCountRef.current = 0;
        
        // Cleanup Native Audio API
        if (nativeRecorderRef.current) {
            try {
                nativeRecorderRef.current.stop();
                nativeRecorderRef.current.disconnect();
                console.log('[ASR Frontend] Native Audio Recorder stopped and disconnected');
            } catch (e) {
                console.warn('[ASR Frontend] Error stopping native recorder:', e);
            }
            nativeRecorderRef.current = null;
        }

        // Cleanup Web Audio API
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        console.log('[ASR Frontend] 发送 asr_stop 到后端');
        apiSocket.send('asr_stop', { sessionId });
    }, [sessionId]);

    const startListening = useCallback(async () => {
        console.log('[ASR Frontend] startListening() 被调用');
        
        try {
            // 请求麦克风权限（兼容移动端和Web）
            const permissionResult = await requestMicrophonePermission();
            if (!permissionResult.granted) {
                showMicrophonePermissionDeniedAlert(permissionResult.canAskAgain);
                return;
            }

            // 重置状态
            resultTextArrayRef.current = [];
            chunkCountRef.current = 0;
            if (onTextUpdate) {
                console.log('[ASR Frontend] 清空输入框');
                onTextUpdate(''); // 清空输入框
            } else {
                console.warn('[ASR Frontend] 警告: onTextUpdate 回调函数未传入！');
            }

            setIsListening(true);
            console.log('[ASR Frontend] 发送 asr_start 到后端');
            apiSocket.send('asr_start', { sessionId });

            if (Platform.OS === 'web') {
                // --- Web 端实现 ---
                console.log('[ASR Frontend] 正在获取 Web 麦克风音频流...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('[ASR Frontend] 麦克风权限已获取，获得音频流:', stream.id);
                streamRef.current = stream;

                // 初始化 AudioContext (科大讯飞要求 16000 采样率)
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContextClass({
                    sampleRate: 16000
                });
                console.log(`[ASR Frontend] AudioContext 初始化完成, 采样率: ${audioContextRef.current.sampleRate}`);

                mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                // 讯飞建议每 40ms 发送 1280 字节。
                // 选择 1024 帧大概 64ms 发送一次
                scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(1024, 1, 1);

                mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(audioContextRef.current.destination);

                scriptProcessorRef.current.onaudioprocess = (e: any) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    // 转换 float32 为 16-bit PCM
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        let s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    chunkCountRef.current++;
                    if (chunkCountRef.current % 50 === 1) {
                        console.log(`[ASR Frontend] Web: 正在持续发送音频数据块... 当前第 ${chunkCountRef.current} 块, 大小: ${pcmData.buffer.byteLength} bytes`);
                    }

                    // 通过主工程的 socket 发送
                    apiSocket.send('asr_audio_chunk', { 
                        chunk: pcmData.buffer,
                        sessionId 
                    });
                };
            } else {
                // --- 移动端 (iOS/Android) 实现 ---
                console.log('[ASR Frontend] 正在初始化 Native 麦克风录音...');
                
                const { AudioRecorder } = require('react-native-audio-api');
                const recorder = new AudioRecorder({
                    sampleRate: 16000,
                    bufferLengthInSamples: 1024
                });
                
                recorder.onAudioReady((event: any) => {
                    // 获取单声道 float32 数据
                    const inputData = event.buffer.getChannelData(0);
                    
                    // 转换 float32 为 16-bit PCM
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        let s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    chunkCountRef.current++;
                    if (chunkCountRef.current % 50 === 1) {
                        console.log(`[ASR Frontend] Native: 正在持续发送音频数据块... 当前第 ${chunkCountRef.current} 块, 大小: ${pcmData.buffer.byteLength} bytes`);
                    }

                    // 通过主工程的 socket 发送
                    apiSocket.send('asr_audio_chunk', { 
                        chunk: pcmData.buffer,
                        sessionId 
                    });
                });

                nativeRecorderRef.current = recorder;
                recorder.start();
                console.log('[ASR Frontend] Native Audio Recorder 已启动');
            }

        } catch (error) {
            console.error('[ASR Frontend] Failed to start recording:', error);
            setIsListening(false);
            stopListening();
        }
    }, [onTextUpdate, sessionId, stopListening]);

    return {
        isListening,
        startListening,
        stopListening
    };
}
