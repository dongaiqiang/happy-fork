import type { SDKMessage, SDKAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKUserMessage } from '@/claude/sdk'
import type { MessageBuffer } from './ink/messageBuffer'
import { logger } from './logger'

export type OnAssistantResultInkCallback = (result: SDKResultMessage, messageBuffer: MessageBuffer) => void | Promise<void>

/**
 * Formats Claude SDK messages for Ink display
 */
export function formatClaudeMessageForInk(
    message: SDKMessage,
    messageBuffer: MessageBuffer,
    onAssistantResult?: OnAssistantResultInkCallback
): void {
    logger.debugLargeJson('[CLAUDE INK] Message from remote mode:', message)

    const formatHeading = (heading: string, text: string) => `${heading}\n${text}`
    const truncate = (value: string, maxLength: number) => (
        value.length > maxLength ? `${value.substring(0, maxLength)}...` : value
    )

    switch (message.type) {
        case 'system': {
            const sysMsg = message as SDKSystemMessage
            if (sysMsg.subtype === 'init') {
                messageBuffer.addMessage('─'.repeat(40), 'status')
                messageBuffer.addMessage(`Session initialized\n${sysMsg.session_id}`, 'system')
                messageBuffer.addMessage(`  Model: ${sysMsg.model}`, 'status')
                messageBuffer.addMessage(`  CWD: ${sysMsg.cwd}`, 'status')
                if (sysMsg.tools && sysMsg.tools.length > 0) {
                    messageBuffer.addMessage(`  Tools: ${sysMsg.tools.join(', ')}`, 'status')
                }
                messageBuffer.addMessage('─'.repeat(40), 'status')
            }
            break
        }

        case 'user': {
            const userMsg = message as SDKUserMessage
            if (userMsg.message && typeof userMsg.message === 'object' && 'content' in userMsg.message) {
                const content = userMsg.message.content
                
                if (typeof content === 'string') {
                    messageBuffer.addMessage(formatHeading('You', content), 'user')
                } 
                else if (Array.isArray(content)) {
                    for (const block of content) {
                        if (block.type === 'text') {
                            if (typeof block.text === 'string' && block.text.length > 0) {
                                messageBuffer.addMessage(formatHeading('You', block.text), 'user')
                            }
                        } else if (block.type === 'tool_result') {
                            if (block.content) {
                                const outputStr = typeof block.content === 'string' 
                                    ? block.content 
                                    : JSON.stringify(block.content, null, 2)
                                messageBuffer.addMessage(
                                    formatHeading(`Tool Result${block.tool_use_id ? ` · ${block.tool_use_id}` : ''}`, truncate(outputStr, 240)),
                                    'result'
                                )
                            }
                        }
                    }
                }
                else {
                    messageBuffer.addMessage(formatHeading('You', JSON.stringify(content, null, 2)), 'user')
                }
            }
            break
        }

        case 'assistant': {
            const assistantMsg = message as SDKAssistantMessage
            if (assistantMsg.message && assistantMsg.message.content) {
                const textBlocks = assistantMsg.message.content
                    .filter((block) => block.type === 'text' && typeof block.text === 'string' && block.text.length > 0)
                    .map((block) => block.text)

                if (textBlocks.length > 0) {
                    messageBuffer.addMessage(formatHeading('Claude', textBlocks.join('\n\n')), 'assistant')
                }
                
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'tool_use') {
                        if (block.input) {
                            const inputStr = JSON.stringify(block.input, null, 2)
                            messageBuffer.addMessage(
                                formatHeading(`Tool · ${block.name}`, truncate(inputStr, 500)),
                                'tool'
                            )
                        } else {
                            messageBuffer.addMessage(formatHeading(`Tool · ${block.name}`, 'Started'), 'tool')
                        }
                    }
                }
            }
            break
        }

        case 'result': {
            const resultMsg = message as SDKResultMessage
            if (resultMsg.subtype === 'success') {
                if ('result' in resultMsg && resultMsg.result) {
                    messageBuffer.addMessage(formatHeading('Summary', resultMsg.result || ''), 'result')
                }
                
                if (resultMsg.usage) {
                    const stats = [
                        `Turns: ${resultMsg.num_turns}`,
                        `Input tokens: ${resultMsg.usage.input_tokens}`,
                        `Output tokens: ${resultMsg.usage.output_tokens}`,
                        resultMsg.usage.cache_read_input_tokens ? `Cache read tokens: ${resultMsg.usage.cache_read_input_tokens}` : null,
                        resultMsg.usage.cache_creation_input_tokens ? `Cache creation tokens: ${resultMsg.usage.cache_creation_input_tokens}` : null,
                        `Cost: $${resultMsg.total_cost_usd.toFixed(4)}`,
                        `Duration: ${resultMsg.duration_ms}ms`
                    ].filter((line): line is string => !!line)
                    messageBuffer.addMessage(formatHeading('Session Stats', stats.join('\n')), 'status')

                    if (onAssistantResult) {
                        Promise.resolve(onAssistantResult(resultMsg, messageBuffer)).catch(err => {
                            logger.debug('Error in onAssistantResult callback:', err)
                        })
                    }
                }
            } else if (resultMsg.subtype === 'error_max_turns') {
                messageBuffer.addMessage(formatHeading('Error', 'Maximum turns reached'), 'result')
                messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns`, 'status')
            } else if (resultMsg.subtype === 'error_during_execution') {
                messageBuffer.addMessage(formatHeading('Error', 'Execution failed'), 'result')
                messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns before error`, 'status')
                logger.debugLargeJson('[RESULT] Error during execution', resultMsg)
            }
            break
        }

        default: {
            if (process.env.DEBUG) {
                messageBuffer.addMessage(`[Unknown message type: ${message.type}]`, 'status')
            }
        }
    }
}
