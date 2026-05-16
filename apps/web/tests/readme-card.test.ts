import { describe, expect, it } from 'vitest';
import { renderReadmeCardSvg } from '../lib/readme-card';

const card = {
  displayName: 'Peng <Dev>',
  periodLabel: '7d',
  tokenLabel: '1.2M',
  costLabel: '$12.35 estimated',
  liveLabel: 'Coding now',
  liveTone: 'live' as const,
  streakLabel: '3d',
  topModel: 'claude-sonnet-4-6',
  milestoneLabel: '30 DAY STREAK',
  timeSavedLabel: '~124 hrs',
  peakActivityLabel: '23:00 - 02:00',
  sparkline: [0, 50, 25, 100, 80],
  theme: 'light' as const,
};

describe('README card SVG', () => {
  it('renders escaped profile and summary fields', () => {
    const svg = renderReadmeCardSvg(card);
    expect(svg).toContain('Peng &lt;Dev&gt;');
    expect(svg).toContain('1.2M');
    expect(svg).toContain('Est. Cost:');
    expect(svg).toContain('$12.35');
    expect(svg).toContain('Coding now');
    expect(svg).toContain('claude-sonnet-4-6');
    expect(svg).toContain('30 DAY STREAK');
  });

  it('renders the polished README card layout', () => {
    const svg = renderReadmeCardSvg(card);

    expect(svg).toContain('width="800" height="330"');
    expect(svg).toContain('rx="12"');
    expect(svg).toContain('tokens processed');
    expect(svg).toContain('Last 7 Days');
    expect(svg).toContain('Model');
    expect(svg).toContain('Time Saved');
    expect(svg).toContain('~124 hrs');
    expect(svg).toContain('Peak Act.');
    expect(svg).toContain('23:00 - 02:00');
    expect(svg).toContain('Streak');
    expect(svg).not.toContain('Source');
    expect(svg).toContain('linearGradient id="chartGradient');
    expect(svg).toContain('class="entry-smooth');
    expect(svg).toContain('class="chart-line-smooth');
    expect(svg).toContain('class="chart-fill-smooth');
    expect(svg).toContain('class="stat-module');
    expect(svg).toContain('.stat-module:hover');
    expect(svg).not.toContain('class="path-glow');
    expect(svg).not.toContain('animate-float');
  });

  it('places the milestone badge inline with the profile header', () => {
    const svg = renderReadmeCardSvg(card);

    expect(svg).toContain('<g transform="translate(88, 17)">');
    expect(svg).toContain('✦');
    expect(svg).not.toContain('x="55" y="82"');
  });

  it('does not leak missing palette values into the SVG', () => {
    const svg = renderReadmeCardSvg(card);

    expect(svg).not.toContain('undefined');
    expect(svg).not.toContain('NaN');
  });

  it('escapes dynamic labels and keeps font attributes valid', () => {
    const svg = renderReadmeCardSvg({
      ...card,
      costLabel: '$1.23 & "estimated"',
      liveLabel: 'Coding <now> & "live"',
      topModel: 'm <fast> & "q"',
      milestoneLabel: '30 <DAY> & "STREAK"',
      peakActivityLabel: '23:00 < 02:00 & "late"',
    });
    expect(svg).toContain('$1.23 &amp; &quot;…');
    expect(svg).toContain('Coding &lt;now&gt; &amp; &quot;l…');
    expect(svg).toContain('m &lt;fast&gt; &amp; &quot;q&quot;');
    expect(svg).toContain('30 &lt;DAY&gt; &amp; &quot;STREAK&quot;');
    expect(svg).toContain('23:00 &lt; 02:0…');
    expect(svg).not.toContain('"Segoe UI"');
  });

  it('renders hidden cost, inactive live, and null milestone states without placeholders', () => {
    const svg = renderReadmeCardSvg({
      ...card,
      costLabel: 'hidden',
      liveLabel: 'Live hidden',
      liveTone: 'private',
      milestoneLabel: null,
      sparkline: [],
    });
    expect(svg).toContain('hidden');
    expect(svg).toContain('Live hidden');
    expect(svg).not.toContain('null');
    expect(svg).not.toContain('PLACEHOLDER');
  });

  it('keeps long header names from colliding with the milestone pill', () => {
    const svg = renderReadmeCardSvg({
      ...card,
      displayName: 'Alexandria Catherine Montgomery-Williams',
      milestoneLabel: '100 DAY STREAK',
    });

    expect(svg).toContain('Alexandria Catherine…');
    expect(svg).toContain('100 DAY STREAK');
    expect(svg).not.toContain('Alexandria Catherine Montgomery-Williams');
  });

  it('clamps footer values to stay within their columns', () => {
    const svg = renderReadmeCardSvg({
      ...card,
      topModel: 'claude-sonnet-4-6-with-provider-suffix',
      timeSavedLabel: '~123456789012345 hrs',
      peakActivityLabel: '23:00 - 02:00 with suffix',
      streakLabel: '123456789012345d',
    });

    expect(svg).toContain('claude-sonnet-4-…');
    expect(svg).toContain('~12345678901…');
    expect(svg).toContain('23:00 - 02:0…');
    expect(svg).toContain('1234567…');
    expect(svg).not.toContain('claude-sonnet-4-6-with-provider-suffix');
    expect(svg).not.toContain('~123456789012345 hrs');
    expect(svg).not.toContain('23:00 - 02:00 with suffix');
    expect(svg).not.toContain('123456789012345d');
  });

  it('clamps long dynamic labels for the fixed card layout', () => {
    const svg = renderReadmeCardSvg({
      ...card,
      displayName: 'Peng'.repeat(20),
      costLabel: '$123456789012345678901234567890 estimated',
      liveLabel: 'Coding live right now with a very long label',
      streakLabel: '12345678901234567890d',
      topModel: 'claude-sonnet-4-6-with-an-unusually-long-provider-suffix',
      milestoneLabel: 'A VERY LONG MILESTONE LABEL THAT SHOULD NOT BREAK THE HEADER',
      timeSavedLabel: '~123456789012345 hrs',
      peakActivityLabel: '23:00 - 02:00 with an unusually long suffix',
    });

    expect(svg).toContain('…');
    expect(svg).not.toContain('PengPengPengPengPengPengPengPengPengPengPengPengPengPengPeng');
    expect(svg).not.toContain('claude-sonnet-4-6-with-an-unusually-long-provider-suffix');
    expect(svg).not.toContain('A VERY LONG MILESTONE LABEL THAT SHOULD NOT BREAK THE HEADER');
    expect(svg).not.toContain('23:00 - 02:00 with an unusually long suffix');
  });
});
