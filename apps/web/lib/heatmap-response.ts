import { type HeatmapResponse, heatmapResponseSchema } from '@nowcoding/core/schemas';

export function toPublicHeatmapResponse(
  heatmap: HeatmapResponse,
  showCost: boolean,
): HeatmapResponse {
  return heatmapResponseSchema.parse({
    ...heatmap,
    cells: heatmap.cells.map((cell) => ({
      ...cell,
      estimatedCostUsd: showCost ? cell.estimatedCostUsd : null,
    })),
  });
}
