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
// Can this tile be searched: does ENTER open a map that could hold the dog?
// v13: plains and forest. M2 and M3: wherever enterKind() says "WILD". From M4:
// "WILD" or "RUIN" (natural ruins and the threshold have a map of their own).
function __enterableWild(x,y){
  if (typeof enterKind === "function"){ const k = enterKind(x,y); return k === "WILD" || k === "RUIN"; }
  const t = finalTileAt(x,y); return t === "." || t === "F";
}
// Wilderness and nothing else.
function __isWild(x,y){
  if (typeof enterKind === "function") return enterKind(x,y) === "WILD";
  const t = finalTileAt(x,y); return t === "." || t === "F";
}
// The map ENTER opens on a tile that can be searched.
function __localAt(x,y){
  if (typeof generateRuin === "function" && enterKind(x,y) === "RUIN") return generateRuin(x,y);
  return generateWilderness(x,y);
}
// A dog tile: it can be searched, the dog is "very near", and the map ENTER opens holds the dog.
function __isDogTile(x,y){ return __enterableWild(x,y) && dogIsVeryNear(x,y) && !!__localAt(x,y).dog; }
function __isNaturalRuin(x,y){ return tileAt(x,y) === "R" && !isTownAt(x,y); }
// The step the war starts and the step the capital falls. From M4 they are dates read
// from the seed. Before M4 they were rolled each step: these replay v13's rolls.
function __warStep(limit){
  if (typeof dates === "function") return dates().war;
  for (let s = 29; s <= (limit||400); s++) if (noise01(s, 9001, SEED ^ 0xBEEF) < 0.08) return s; return -1;
}
function __fallStep(limit){
  if (typeof dates === "function") return dates().fall;
  for (let s = 61; s <= (limit||400); s++) if (noise01(s, 1337, SEED ^ 0xC0DE) < 0.06) return s; return -1;
}
`;
