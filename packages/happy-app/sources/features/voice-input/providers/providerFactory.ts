import { VoiceButtonDecision, VoiceButtonState, VoiceInputMode } from './types';

export function resolveVoiceInputMode(mode?: string | null): VoiceInputMode {
    return mode === 'streaming_asr' ? 'streaming_asr' : 'elevenlabs_call';
}

export function decideVoiceButton(mode: VoiceInputMode, state: VoiceButtonState): VoiceButtonDecision {
    if (mode === 'streaming_asr') {
        return {
            showStreamingAsrButton: true,
            showSendButton: false,
            showLegacyMicButton: false
        };
    }

    const showSendButton = state.hasText || !!state.isSending || !!state.isMicActive;
    const showLegacyMicButton = !showSendButton && state.hasMicAction && !state.isMicActive;
    return {
        showStreamingAsrButton: false,
        showSendButton,
        showLegacyMicButton
    };
}
