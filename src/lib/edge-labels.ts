export interface LabelCandidate {
  x: number;
  y: number;
}
export interface LabelPlacementInput {
  id: string;
  width: number;
  height: number;
  candidates: LabelCandidate[];
}
/** Greedy, deterministic screen-space box placement; best effort for dense graphs. */
export function getAllNonOverlappingLabelPositions(
  inputs: LabelPlacementInput[],
  obstacles: { x: number; y: number; width: number; height: number }[] = [],
) {
  const occupied = [...obstacles];
  const result = new Map<string, LabelCandidate>();
  for (const input of [...inputs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    let best = input.candidates[0],
      score = Infinity;
    input.candidates.forEach((point, index) => {
      const overlap = occupied.reduce((sum, box) => {
        const width = Math.max(0, (box.width + input.width) / 2 - Math.abs(box.x - point.x));
        const height = Math.max(0, (box.height + input.height) / 2 - Math.abs(box.y - point.y));
        return sum + width * height;
      }, 0);
      const candidateScore = overlap * 1000 + index;
      if (candidateScore < score) {
        score = candidateScore;
        best = point;
      }
    });
    result.set(input.id, best);
    occupied.push({ ...best, width: input.width, height: input.height });
  }
  return result;
}

export function getPointAlongPolyline(points: LabelCandidate[], ratio: number): LabelCandidate {
  const lengths = points
    .slice(1)
    .map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return { ...points[0] };
  let remaining = total * Math.max(0, Math.min(1, ratio));
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] && lengths[index] > 0) {
      const weight = remaining / lengths[index];
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * weight,
        y: points[index].y + (points[index + 1].y - points[index].y) * weight,
      };
    }
    remaining -= lengths[index];
  }
  return { ...points[points.length - 1] };
}
