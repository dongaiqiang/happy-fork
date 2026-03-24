import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { hapticsLight } from '@/components/haptics';
import { useCustomASR } from './useCustomASR';

export const CustomASRButton = React.memo((props: { styles: any, onTextUpdate?: (text: string) => void, sessionId?: string }) => {
    const { theme } = useUnistyles();
    const { isListening, startListening, stopListening } = useCustomASR({
        onTextUpdate: props.onTextUpdate,
        sessionId: props.sessionId
    });

    const handlePress = () => {
        hapticsLight();
        if (isListening) {
            console.log('[CustomASRButton] Button pressed, stopping...');
            stopListening();
        } else {
            console.log('[CustomASRButton] Button pressed, starting...');
            startListening();
        }
    };

    return (
        <View
            style={[
                props.styles.sendButton,
                props.styles.sendButtonActive,
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
            >
                {isListening ? (
                    <Ionicons name="stop" size={18} color="#fff" />
                ) : (
                    <Ionicons name="mic-outline" size={18} color={theme.colors.button.primary.tint} />
                )}
            </Pressable>
        </View>
    );
});
