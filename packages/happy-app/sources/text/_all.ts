/**
 * Centralized language configuration for the Happy app
 * This file contains all supported languages, their metadata, and configuration
 * 
 * When adding a new language:
 * 1. Add the language code to the SupportedLanguage type
 * 2. Add the language metadata to SUPPORTED_LANGUAGES
 * 3. Create a new translation file in translations/[code].ts
 * 4. Re-add the language to the translations object in index.ts
 */

/**
 * Supported language codes
 */
export type SupportedLanguage = 'en' | 'zh-Hans' | 'zh-Hant';

/**
 * Language metadata interface
 */
export interface LanguageInfo {
    code: SupportedLanguage;
    nativeName: string;
    englishName: string;
}

/**
 * All supported languages with their native and English names
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
    en: {
        code: 'en',
        nativeName: 'English',
        englishName: 'English'
    },
    'zh-Hans': {
        code: 'zh-Hans',
        nativeName: '中文(简体)',
        englishName: 'Chinese (Simplified)'
    },
    'zh-Hant': {
        code: 'zh-Hant',
        nativeName: '中文(繁體)',
        englishName: 'Chinese (Traditional)'
    }
} as const;

/**
 * Helper to get language native name by code
 */
export function getLanguageNativeName(code: SupportedLanguage): string {
    return SUPPORTED_LANGUAGES[code].nativeName;
}

/**
 * Helper to get language English name by code
 */
export function getLanguageEnglishName(code: SupportedLanguage): string {
    return SUPPORTED_LANGUAGES[code].englishName;
}

/**
 * Array of all supported language codes
 */
export const SUPPORTED_LANGUAGE_CODES: SupportedLanguage[] = Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[];

/**
 * Default language code
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function resolveSupportedLanguageFromLocale(locale?: {
    languageCode?: string | null;
    languageTag?: string | null;
    languageScriptCode?: string | null;
}): SupportedLanguage | null {
    if (!locale?.languageCode) {
        return null;
    }

    if (locale.languageCode === 'zh') {
        if (locale.languageScriptCode === 'Hant' || locale.languageTag?.includes('Hant')) {
            return 'zh-Hant';
        }

        return 'zh-Hans';
    }

    if (locale.languageCode === 'en') {
        return 'en';
    }

    return null;
}
