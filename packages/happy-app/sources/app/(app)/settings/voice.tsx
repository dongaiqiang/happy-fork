import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable, useLocalSettingMutable } from '@/sync/storage';
import { useUnistyles } from 'react-native-unistyles';
import { findLanguageByCode, getLanguageDisplayName, LANGUAGES } from '@/constants/Languages';
import { t } from '@/text';

export default function VoiceSettingsScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [voiceAssistantLanguage] = useSettingMutable('voiceAssistantLanguage');
    const [voiceInputMode, setVoiceInputMode] = useLocalSettingMutable('voiceInputMode');
    
    // Find current language or default to first option
    const currentLanguage = findLanguageByCode(voiceAssistantLanguage) || LANGUAGES[0];
    
    return (
        <ItemList style={{ paddingTop: 0 }}>
            {/* Input Mode Settings */}
            <ItemGroup 
                title="语音输入模式"
                footer="点击切换：默认使用 ElevenLabs 进行英文对话，或使用流式 ASR 进行极速中文识别。"
            >
                <Item
                    title="语音识别引擎"
                    subtitle={voiceInputMode === 'elevenlabs_call' ? 'ElevenLabs (默认)' : '自定义云端 ASR (实时出字)'}
                    icon={<Ionicons name="mic-circle-outline" size={29} color="#34C759" />}
                    onPress={() => {
                        setVoiceInputMode(voiceInputMode === 'elevenlabs_call' ? 'streaming_asr' : 'elevenlabs_call');
                    }}
                />
            </ItemGroup>

            {/* Language Settings */}
            <ItemGroup 
                title={t('settingsVoice.languageTitle')}
                footer={t('settingsVoice.languageDescription')}
            >
                <Item
                    title={t('settingsVoice.preferredLanguage')}
                    subtitle={t('settingsVoice.preferredLanguageSubtitle')}
                    icon={<Ionicons name="language-outline" size={29} color="#007AFF" />}
                    detail={getLanguageDisplayName(currentLanguage)}
                    onPress={() => router.push('/settings/voice/language')}
                />
            </ItemGroup>

        </ItemList>
    );
}