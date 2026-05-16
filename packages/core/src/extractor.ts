import { createHash } from 'node:crypto';
import type { RawUsageRecord, SessionRecord } from './types';

const ACTIVE_GAP_MS = 5 * 60 * 1000;

export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
}

export interface MessageRecord extends RawUsageRecord {
  isUser?: boolean;
}

export function extractSessions(messages: Iterable<MessageRecord>): SessionRecord[] {
  const groups = new Map<string, MessageRecord[]>();
  for (const m of messages) {
    const id = m.sessionId;
    if (!id) continue;
    let arr = groups.get(id);
    if (!arr) {
      arr = [];
      groups.set(id, arr);
    }
    arr.push(m);
  }

  const out: SessionRecord[] = [];
  for (const [id, msgs] of groups) {
    msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    if (!first || !last) continue;

    let active = 0;
    for (let i = 0; i < msgs.length; i++) {
      const cur = msgs[i];
      const next = msgs[i + 1];
      if (!cur) continue;
      if (next) {
        const gap = next.timestamp.getTime() - cur.timestamp.getTime();
        active += Math.min(gap, ACTIVE_GAP_MS);
      }
    }

    const userPromptHours = new Array<number>(24).fill(0);
    let userMessageCount = 0;
    for (const m of msgs) {
      if (m.isUser) {
        userMessageCount++;
        const hour = m.timestamp.getUTCHours();
        userPromptHours[hour] = (userPromptHours[hour] ?? 0) + 1;
      }
    }

    out.push({
      source: first.source,
      project: first.project,
      sessionHash: hashSessionId(id),
      firstMessageAt: first.timestamp,
      lastMessageAt: last.timestamp,
      durationSeconds: Math.max(
        0,
        Math.round((last.timestamp.getTime() - first.timestamp.getTime()) / 1000),
      ),
      activeSeconds: Math.round(active / 1000),
      messageCount: msgs.length,
      userMessageCount,
      userPromptHours,
    });
  }
  return out.sort((a, b) => a.firstMessageAt.getTime() - b.firstMessageAt.getTime());
}
