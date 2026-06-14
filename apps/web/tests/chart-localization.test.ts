import { ModelPie } from '@/components/ModelPie';
import { SourceBars } from '@/components/SourceBars';
import { SparklineChart } from '@/components/SparklineChart';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

describe('chart localization labels', () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
  });

  it('keeps default English empty labels for compatibility', () => {
    expect(renderToStaticMarkup(createElement(SparklineChart, { data: [] }))).toContain(
      'No activity yet.',
    );
    expect(renderToStaticMarkup(createElement(ModelPie, { data: [] }))).toContain('No models yet.');
    expect(renderToStaticMarkup(createElement(SourceBars, { data: [] }))).toContain(
      'No tools yet.',
    );
  });

  it('renders localized empty labels without changing data identifiers', () => {
    expect(
      renderToStaticMarkup(
        createElement(SparklineChart, {
          data: [],
          emptyLabel: '暂无活动数据。',
          valueLabel: '个 token',
        }),
      ),
    ).toContain('暂无活动数据。');
    expect(
      renderToStaticMarkup(
        createElement(ModelPie, {
          data: [],
          emptyLabel: '暂无模型数据。',
          valueLabel: '个 token',
        }),
      ),
    ).toContain('暂无模型数据。');
    expect(
      renderToStaticMarkup(
        createElement(SourceBars, {
          data: [],
          emptyLabel: '暂无来源数据。',
          valueLabel: '个 token',
        }),
      ),
    ).toContain('暂无来源数据。');
  });
});
