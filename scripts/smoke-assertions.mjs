export function assertExpectedData(path, json) {
  if (path === '/api/stats') {
    assertObject(path, json);

    if (!isPositiveFinite(json.totalTokens)) {
      throw new Error('/api/stats totalTokens must be greater than 0');
    }

    if (!json.topModel?.name) {
      throw new Error('/api/stats topModel.name must be present');
    }

    if (!json.topSource?.name) {
      throw new Error('/api/stats topSource.name must be present');
    }
  }

  if (path === '/api/now') {
    assertObject(path, json);

    if (!isPositiveFinite(json.todayTokens)) {
      throw new Error('/api/now todayTokens must be greater than 0');
    }

    if (!json.currentSource) {
      throw new Error('/api/now currentSource must be present');
    }

    if (!['live', 'recent', 'idle'].includes(json.status)) {
      throw new Error(`/api/now status must be active, got ${json.status}`);
    }
  }

  if (path === '/api/heatmap') {
    assertObject(path, json);

    if (!Array.isArray(json.cells)) {
      throw new Error('/api/heatmap cells must be an array');
    }

    if (!json.cells.some((cell) => isPositiveFinite(cell?.tokens))) {
      throw new Error('/api/heatmap must include at least one active cell');
    }
  }
}

function assertObject(path, json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`${path} response must be a JSON object`);
  }
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}
