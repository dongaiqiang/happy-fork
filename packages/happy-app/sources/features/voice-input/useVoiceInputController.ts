import { useLocalSetting } from '@/sync/storage';
import { decideVoiceButton, resolveVoiceInputMode, useLegacyVoiceProvider } from './providers';

interface UseVoiceInputControllerProps {
    hasText: boolean;
    isSending?: boolean;
    isSendDisabled?: boolean;
    onSend: () => void;
    onMicPress?: () => void;
    isMicActive?: boolean;
    sessionId?: string;
    onTextUpdate?: (text: string) => void;
    forceMode?: 'elevenlabs_call' | 'streaming_asr';
}

export function useVoiceInputController(props: UseVoiceInputControllerProps) {
    const systemVoiceInputMode = useLocalSetting('voiceInputMode');
    const voiceInputMode = resolveVoiceInputMode(props.forceMode || systemVoiceInputMode);

    const buttonDecision = decideVoiceButton(voiceInputMode, {
        hasText: props.hasText,
        isSending: props.isSending,
        hasMicAction: !!props.onMicPress,
        isMicActive: props.isMicActive
    });

    const legacyVoice = useLegacyVoiceProvider({
        hasText: props.hasText,
        isSending: props.isSending,
        isSendDisabled: props.isSendDisabled,
        hasMicAction: !!props.onMicPress,
        isMicActive: props.isMicActive,
        onSend: props.onSend,
        onMicPress: props.onMicPress
    });

    return {
        buttonDecision,
        legacyVoice,
        customAsrProps: {
            sessionId: props.sessionId,
            onTextUpdate: props.onTextUpdate,
            hasText: props.hasText,
            isSending: props.isSending,
            isSendDisabled: props.isSendDisabled,
            onSend: props.onSend
        }
    };
}
