// Read-only helpers that tools inject into a loaded game to plan routes and
// measure worlds. They use the game's own passable(), finalTileAt() and
// generators, and they change no game state.

export const HELPERS = `
function __bfsFrom(sx, sy){
  const N = WORLD_SIZE;
  const dist = new Int16Array(N*N).fill(-1), prev = new Int16Array(N*N).fill(-1);
  const q = [[sx,sy]]; dist[sy*N+sx] = 0;
  for (let h = 0; h < q.length; h++){
    const x = q[h][0], y = q[h][1];
    for (const d of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nx = x+d[0], ny = y+d[1];
      if (nx<0||ny<0||nx>=N||ny>=N) continue;
      const i = ny*N+nx;
      if (dist[i] >= 0 || !passable(nx,ny)) continue;
      dist[i] = dist[y*N+x] + 1; prev[i] = y*N+x; q.push([nx,ny]);
    }
  }
  return {dist, prev};
}
// Shortest walkable path as a list of N/E/S/W, or null.
function __pathTo(sx,sy,tx,ty){
  const N = WORLD_SIZE;
  const r = __bfsFrom(sx,sy);
  if (r.dist[ty*N+tx] < 0) return null;
  const cmds = []; let cur = ty*N+tx;
  while (cur !== sy*N+sx){
    const p = r.prev[cur], cx = cur%N, cy = (cur/N)|0, px = p%N, py = (p/N)|0;
    cmds.push(cx>px ? "E" : cx<px ? "W" : cy>py ? "S" : "N"); cur = p;
  }
  return cmds.reverse();
}
// Nearest reachable tile satisfying pred, by walking distance from the player.
function __find(pred){
  const N = WORLD_SIZE;
  const r = __bfsFrom(player.x, player.y); let best = null;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const d = r.dist[y*N+x]; if (d < 0) continue;
    if (pred(x,y,d) && (!best || d < best.d)) best = {x:x, y:y, d:d};
  }
  return best;
}
function __enterableWild(x,y){ const t = finalTileAt(x,y); return t === "." || t === "F"; }
// A dog tile: plains or forest, very near, and the wilderness roll places the dog.
function __isDogTile(x,y){ return __enterableWild(x,y) && dogIsVeryNear(x,y) && !!generateWilderness(x,y).dog; }
function __isNaturalRuin(x,y){ return tileAt(x,y) === "R" && !isTownAt(x,y); }
function __warStep(limit){ for (let s = 29; s <= (limit||400); s++) if (noise01(s, 9001, SEED ^ 0xBEEF) < 0.08) return s; return -1; }
function __fallStep(limit){ for (let s = 61; s <= (limit||400); s++) if (noise01(s, 1337, SEED ^ 0xC0DE) < 0.06) return s; return -1; }
`;
