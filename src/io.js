// The seam between the game's logic and the page.
//
// Logic never touches the page. It calls the functions below, under the
// names v13 used, and they forward to whatever host main.js (or a test) has
// installed. HOST is mutated in place by setHost and never replaced.

export const HOST = {
  out(text, cls) {},     // append one line to the log; cls "m" is the muted narrator voice
  clear() {},            // empty the log
  render() {},           // redraw the map, labels and status line from G
  legend() {},           // draw the legend
  freshSeed() { throw new Error("no host installed: cannot make an unseeded world"); },
};

export function setHost(h){ Object.assign(HOST, h); }

export function log(text, cls){ HOST.out(text, cls); }

export function clearLogSoft(){ HOST.clear(); }

export function render(){ HOST.render(); }

export function renderLegend(){ HOST.legend(); }

export function freshSeed(){ return HOST.freshSeed(); }
