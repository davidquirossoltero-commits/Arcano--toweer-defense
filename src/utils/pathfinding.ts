import { GridCoord } from '../types/game';

export function coordKey(col: number, row: number): string {
  return `${col},${row}`;
}

const DIRS: GridCoord[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
];

/**
 * Computes shortest Manhattan/4-way path on grid from start to goal using A*.
 * Returns array of GridCoords including start and goal, or null if blocked.
 */
export function findPathAStar(
  cols: number,
  rows: number,
  start: GridCoord,
  goal: GridCoord,
  blockedSet: Set<string>
): GridCoord[] | null {
  const startK = coordKey(start.col, start.row);
  const goalK = coordKey(goal.col, goal.row);

  if (blockedSet.has(startK) || blockedSet.has(goalK)) {
    return null;
  }

  const openList: GridCoord[] = [start];
  const openSet = new Set<string>([startK]);
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, GridCoord>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startK, 0);
  fScore.set(startK, Math.abs(goal.col - start.col) + Math.abs(goal.row - start.row));

  while (openList.length > 0) {
    // Find node with lowest fScore
    let bestIdx = 0;
    let bestF = fScore.get(coordKey(openList[0].col, openList[0].row)) ?? Infinity;
    for (let i = 1; i < openList.length; i++) {
      const k = coordKey(openList[i].col, openList[i].row);
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }

    const current = openList[bestIdx];
    const currentK = coordKey(current.col, current.row);

    if (current.col === goal.col && current.row === goal.row) {
      const path: GridCoord[] = [current];
      let currKey = currentK;
      while (cameFrom.has(currKey)) {
        const prev = cameFrom.get(currKey)!;
        path.push(prev);
        currKey = coordKey(prev.col, prev.row);
      }
      path.reverse();
      return path;
    }

    openList.splice(bestIdx, 1);
    openSet.delete(currentK);
    closedSet.add(currentK);

    const currentG = gScore.get(currentK) ?? 0;

    for (const d of DIRS) {
      const ncol = current.col + d.col;
      const nrow = current.row + d.row;

      if (ncol < 0 || ncol >= cols || nrow < 0 || nrow >= rows) continue;

      const nk = coordKey(ncol, nrow);
      if (closedSet.has(nk) || blockedSet.has(nk)) continue;

      // Slight tie-breaker preference for straight lines
      const tentativeG = currentG + 1;
      const prevG = gScore.get(nk) ?? Infinity;

      if (tentativeG < prevG) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentativeG);
        const h = Math.abs(goal.col - ncol) + Math.abs(goal.row - nrow);
        fScore.set(nk, tentativeG + h * 1.001);

        if (!openSet.has(nk)) {
          openList.push({ col: ncol, row: nrow });
          openSet.add(nk);
        }
      }
    }
  }

  return null;
}

/**
 * Validates whether placing a tower at (candidateCol, candidateRow) keeps all spawns
 * and all currently active enemy positions connected to the goal.
 */
export function validateMazePlacement(
  cols: number,
  rows: number,
  spawns: GridCoord[],
  goal: GridCoord,
  currentBlocked: Set<string>,
  candidateCol: number,
  candidateRow: number,
  enemyCells: GridCoord[]
): { valid: boolean; spawnPaths: GridCoord[][] } {
  const candidateK = coordKey(candidateCol, candidateRow);
  if (currentBlocked.has(candidateK)) {
    return { valid: false, spawnPaths: [] };
  }

  for (const sp of spawns) {
    if (sp.col === candidateCol && sp.row === candidateRow) {
      return { valid: false, spawnPaths: [] };
    }
  }
  if (goal.col === candidateCol && goal.row === candidateRow) {
    return { valid: false, spawnPaths: [] };
  }

  // Cannot place directly on a cell occupied by an enemy
  for (const ec of enemyCells) {
    if (ec.col === candidateCol && ec.row === candidateRow) {
      return { valid: false, spawnPaths: [] };
    }
  }

  const testBlocked = new Set(currentBlocked);
  testBlocked.add(candidateK);

  const spawnPaths: GridCoord[][] = [];
  for (const sp of spawns) {
    const p = findPathAStar(cols, rows, sp, goal, testBlocked);
    if (!p) {
      return { valid: false, spawnPaths: [] };
    }
    spawnPaths.push(p);
  }

  // Verify every active enemy cell can still reach goal
  const checkedEnemyCells = new Set<string>();
  for (const ec of enemyCells) {
    const ek = coordKey(ec.col, ec.row);
    if (checkedEnemyCells.has(ek)) continue;
    checkedEnemyCells.add(ek);
    const ep = findPathAStar(cols, rows, ec, goal, testBlocked);
    if (!ep) {
      return { valid: false, spawnPaths: [] };
    }
  }

  return { valid: true, spawnPaths };
}
