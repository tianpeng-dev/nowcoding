const HOSTNAME = 'nowcoding-rc-rehearsal';
const PROJECT = 'release-rehearsal';

const PLANNED_TOOLS = [
  { source: 'codex', model: 'gpt-5.5' },
  { source: 'claude-code', model: 'claude-sonnet-4-6' },
  { source: 'cursor', model: 'gpt-5.4' },
  { source: 'gemini-cli', model: 'gemini-2.5-pro' },
];

function hourStart(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()),
  );
}

function addMs(date, ms) {
  return new Date(date.getTime() + ms);
}

function userPromptHours(...hours) {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const hour of hours) {
    counts[hour] += 1;
  }
  return counts;
}

export function buildRcFixture(now = new Date()) {
  const currentHour = hourStart(now);
  const bucketStarts = [
    currentHour,
    addMs(currentHour, -60 * 60 * 1000),
    addMs(currentHour, -24 * 60 * 60 * 1000),
    addMs(currentHour, -6 * 24 * 60 * 60 * 1000),
  ];

  const buckets = PLANNED_TOOLS.map((tool, index) => {
    const inputTokens = 1200 + index * 450;
    const outputTokens = 360 + index * 180;
    const cachedInputTokens = index * 80;
    const reasoningOutputTokens = index * 40;

    return {
      source: tool.source,
      model: tool.model,
      project: PROJECT,
      bucketStart: bucketStarts[index].toISOString(),
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningOutputTokens,
      totalTokens: inputTokens + outputTokens + cachedInputTokens + reasoningOutputTokens,
      requestCount: 2 + index,
    };
  });

  const sessions = [
    {
      source: 'codex',
      project: PROJECT,
      sessionHash: 'a1b2c3d4e5f60718',
      firstMessageAt: addMs(currentHour, -42 * 60 * 1000).toISOString(),
      lastMessageAt: addMs(currentHour, -6 * 60 * 1000).toISOString(),
      durationSeconds: 2160,
      activeSeconds: 1320,
      messageCount: 12,
      userMessageCount: 5,
      userPromptHours: userPromptHours(currentHour.getUTCHours()),
    },
    {
      source: 'claude-code',
      project: PROJECT,
      sessionHash: '0f1e2d3c4b5a6978',
      firstMessageAt: addMs(currentHour, -86 * 60 * 1000).toISOString(),
      lastMessageAt: addMs(currentHour, -62 * 60 * 1000).toISOString(),
      durationSeconds: 1440,
      activeSeconds: 780,
      messageCount: 9,
      userMessageCount: 4,
      userPromptHours: userPromptHours(addMs(currentHour, -60 * 60 * 1000).getUTCHours()),
    },
  ];

  const fixture = {
    hostname: HOSTNAME,
    ingest: { buckets, sessions },
    heartbeat: {
      source: 'codex',
      model: 'gpt-5.5',
      project: PROJECT,
      observedAt: now.toISOString(),
    },
  };

  Object.defineProperty(fixture, 'toJSON', {
    value() {
      return {
        hostname: this.hostname,
        ingest: {
          buckets: this.ingest.buckets.map(
            ({ source, model, project, bucketStart, requestCount }) => ({
              source,
              model,
              project,
              bucketStart,
              requestCount,
            }),
          ),
          sessions: this.ingest.sessions.map(({ userPromptHours: _hours, ...session }) => session),
        },
        heartbeat: this.heartbeat,
      };
    },
  });

  return fixture;
}
