export { resolveVoiceInputMode, getVoiceModeStrategy, decideVoiceButton } from './providerFactory';
export type { VoiceInputMode, VoiceButtonState, VoiceButtonDecision, VoiceModeStrategy } from './types';
export { useLegacyVoiceProvider } from './useLegacyVoiceProvider';
export { useStreamingAsrProvider } from './useStreamingAsrProvider';
export { appendStreamingAsrText, mergeStreamingDraft, shouldPreferContinueAction, shouldShowStreamingSendAction } from './streamingAsrDraft';
export type { StreamingAsrProviderProps } from './useStreamingAsrProvider';
export type { StreamingAsrUiMode, StreamingAsrUiState } from './streamingAsrDraft';
