/**
 * Daemon-specific types (not related to API/server communication)
 */

import { Metadata } from '@/api/types';
import { ChildProcess } from 'child_process';

/**
 * Session tracking for daemon
 */
export interface TrackedSession {
  startedBy: 'daemon' | string;
  happySessionId?: string;
  happySessionMetadataFromLocalWebhook?: Metadata;
  pid: number;
  childProcess?: ChildProcess;
  error?: string;
  directoryCreated?: boolean;
  message?: string;
  requestedDirectory?: string;
  requestedMachineId?: string;
  spawnedAt?: number;
  /** tmux session identifier (format: session:window) */
  tmuxSessionId?: string;
}
