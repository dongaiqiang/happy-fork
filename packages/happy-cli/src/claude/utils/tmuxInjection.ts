import { logger } from "@/ui/logger";
import { getTmuxUtilities, parseTmuxSessionIdentifier, type TmuxControlSequence } from "@/utils/tmux";

export function buildTmuxInjectionKeys(message: string): Array<string | TmuxControlSequence> {
    const lines = message.split('\n');
    const keys: Array<string | TmuxControlSequence> = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        if (line.length > 0) {
            keys.push(line);
        }
        if (index < lines.length - 1) {
            keys.push('C-m');
        }
    }

    keys.push('C-m');
    return keys;
}

export async function injectMessageIntoTmuxPane(tmuxSessionId: string, message: string): Promise<boolean> {
    try {
        const parsed = parseTmuxSessionIdentifier(tmuxSessionId);
        const tmux = getTmuxUtilities(parsed.session);
        return await tmux.sendMultipleKeys(
            buildTmuxInjectionKeys(message),
            parsed.session,
            parsed.window,
            parsed.pane
        );
    } catch (error) {
        logger.debug('[TMUX INJECTION] Failed to inject message into tmux pane', error);
        return false;
    }
}
