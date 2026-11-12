// Seeded hashing and noise, and one small maths helper. Everything random in
// the game comes from here, keyed on the seed, a position or the step count.

// ---------- Seed ----------
export function fnv1a32(str){
  let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h|0;
}

// ---------- Helpers ----------
export function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function mix32(n){
  n |= 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n | 0;
}

export function noise01(x,y,seed){
  let n = (Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263) + Math.imul(seed|0, 1442695041)) | 0;
  n = mix32(n);
  return (n>>>0) / 4294967296;
}

export function nCentered(x,y,seed){ return noise01(x,y,seed) - 0.5; }
