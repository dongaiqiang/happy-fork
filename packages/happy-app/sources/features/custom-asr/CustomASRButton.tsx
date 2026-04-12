import * as React from 'react';
import { Pressable, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { hapticsLight } from '@/components/haptics';
import { useCustomASR } from './useCustomASR';
import { shouldPreferContinueAction, type StreamingAsrUiState } from '@/features/voice-input';

export const CustomASRButton = React.memo((props: {
    styles: any;
    onTextUpdate?: (text: string) => void;
    sessionId?: string;
    currentText?: string;
    hasText?: boolean;
    isSending?: boolean;
    isSendDisabled?: boolean;
    onSend?: () => void;
    onStateChange?: (state: StreamingAsrUiState) => void;
}) => {
    const { theme } = useUnistyles();
    const { isListening, uiState, startListening, stopListening } = useCustomASR({
        onTextUpdate: props.onTextUpdate,
        sessionId: props.sessionId,
        currentText: props.currentText,
        onStateChange: props.onStateChange
    });
    const preferContinueAction = shouldPreferContinueAction(uiState.mode, !!props.hasText);

    const handlePress = () => {
        hapticsLight();
        if (isListening) {
            console.log('[CustomASRButton] Button pressed, stopping...');
            stopListening();
            return;
        }

        if (preferContinueAction) {
            console.log('[CustomASRButton] Button pressed, continuing current draft...');
            startListening();
            return;
        }

        if (props.hasText) {
            props.onSend?.();
            return;
        }

        if (props.isSendDisabled || props.isSending) {
            return;
        } else {
            console.log('[CustomASRButton] Button pressed, starting...');
            startListening();
        }
    };

    const isShowingSend = (!!props.hasText && !preferContinueAction) || !!props.isSending;
    const isDisabled = (!isListening && !!props.isSendDisabled) || (!isListening && !!props.isSending);

    return (
        <View
            style={[
                props.styles.sendButton,
                isShowingSend || isListening ? props.styles.sendButtonActive : props.styles.sendButtonInactive,
                isListening ? { backgroundColor: theme.colors.status.error } : undefined
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
                onPress={handlePress}
                disabled={isDisabled}
            >
                {isListening ? (
                    <Ionicons name="stop" size={18} color="#fff" />
                ) : props.isSending ? (
                    <ActivityIndicator size="small" color={theme.colors.button.primary.tint} />
                ) : preferContinueAction ? (
                    <Ionicons name="mic" size={18} color={theme.colors.button.primary.tint} />
                ) : props.hasText ? (
                    <Ionicons name="arrow-up" size={18} color={theme.colors.button.primary.tint} />
                ) : (
                    <Ionicons name="mic-outline" size={18} color={theme.colors.button.primary.tint} />
                )}
            </Pressable>
        </View>
    );
});
