import * as React from 'react';
import { Platform, Pressable, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Octicons } from '@expo/vector-icons';
import { useLocalSetting } from '@/sync/storage';
import { useUnistyles } from 'react-native-unistyles';
import { hapticsLight } from '@/components/haptics';
import { CustomASRButton } from './CustomASRButton';

interface SmartVoiceButtonProps {
    hasText: boolean;
    isSending?: boolean;
    isSendDisabled?: boolean;
    onSend: () => void;
    onMicPress?: () => void;
    isMicActive?: boolean;
    styles: any;
    sessionId?: string;
    onTextUpdate?: (text: string) => void;
}

export const SmartVoiceButton = React.memo((props: SmartVoiceButtonProps) => {
    const { theme } = useUnistyles();
    const voiceInputMode = useLocalSetting('voiceInputMode');
    
    // The original logic for Send/ElevenLabs:
    const showSend = props.hasText || props.isSending;
    const showElevenLabsMic = !showSend && props.onMicPress && !props.isMicActive && voiceInputMode === 'elevenlabs_call';
    const showAsrMic = !showSend && voiceInputMode === 'streaming_asr';
    
    if (showAsrMic) {
        return (
            <CustomASRButton 
                styles={props.styles} 
                onTextUpdate={props.onTextUpdate}
                sessionId={props.sessionId}
            />
        );
    }

    return (
        <View
            style={[
                props.styles.sendButton,
                (showSend || showElevenLabsMic || (props.onMicPress && !props.isMicActive))
                    ? props.styles.sendButtonActive
                    : props.styles.sendButtonInactive
            ]}
        >
            <Pressable
                style={(p) => ({
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: p.pressed ? 0.7 : 1,
                })}
                hitSlop={{ top: 5, bottom: 10, left: 0, right: 0 }}
                onPress={() => {
                    hapticsLight();
                    if (props.hasText) {
                        props.onSend();
                    } else if (props.onMicPress) {
                        props.onMicPress();
                    }
                }}
                disabled={props.isSendDisabled || props.isSending || (!props.hasText && !props.onMicPress)}
            >
                {props.isSending ? (
                    <ActivityIndicator
                        size="small"
                        color={theme.colors.button.primary.tint}
                    />
                ) : (props.hasText || props.isMicActive) ? (
                    <Octicons
                        name="arrow-up"
                        size={16}
                        color={theme.colors.button.primary.tint}
                        style={[
                            props.styles.sendButtonIcon,
                            { marginTop: Platform.OS === 'web' ? 2 : 0 }
                        ]}
                    />
                ) : props.onMicPress && !props.isMicActive ? (
                    <Image
                        source={require('@/assets/images/icon-voice-white.png')}
                        style={{
                            width: 24,
                            height: 24,
                        }}
                        tintColor={theme.colors.button.primary.tint}
                    />
                ) : (
                    <Octicons
                        name="arrow-up"
                        size={16}
                        color={theme.colors.button.primary.tint}
                        style={[
                            props.styles.sendButtonIcon,
                            { marginTop: Platform.OS === 'web' ? 2 : 0 }
                        ]}
                    />
                )}
            </Pressable>
        </View>
    );
});
