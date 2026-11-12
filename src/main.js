// Boot: the only module, with render.js, that touches the page, and the only
// one that may use the clock or Math.random (for a world with no seed given).

import { G } from './state.js';
import { render, setHost } from './io.js';
import { fnv1a32 } from './rng.js';
import { appendLine, clearLines, drawLegend, renderPage } from './render.js';
import { runCommand, startNewGame } from './commands.js';

// ---------- Seed ----------
function initialSeed(){
  const p = new URLSearchParams(location.search);
  const s = p.get("seed");
  if (s) return fnv1a32(s);
  return (Date.now() ^ (Math.random()*1e9|0)) | 0;
}

setHost({ out: appendLine, clear: clearLines, render: renderPage, legend: drawLegend, freshSeed: initialSeed });
G.seed = initialSeed();

// ---------- Command history ----------
const history = [];

let hIdx = 0;

function pushHistory(cmd){
  if (!cmd) return;
  if (history.length===0 || history[history.length-1]!==cmd) history.push(cmd);
  if (history.length>100) history.shift();
  hIdx = history.length;
}

const inputEl = document.getElementById("cmd");

document.getElementById("btn").addEventListener("click", ()=>{
  const v = inputEl.value;
  pushHistory(v);
  inputEl.value="";
  runCommand(v);
  render();
  inputEl.focus();
});

inputEl.addEventListener("keydown", (e)=>{
  if (e.key==="ArrowUp"){
    e.preventDefault();
    if (hIdx>0){ hIdx--; inputEl.value = history[hIdx] || ""; }
    return;
  }
  if (e.key==="ArrowDown"){
    e.preventDefault();
    if (hIdx < history.length){ hIdx++; inputEl.value = history[hIdx] || ""; }
    else { hIdx = history.length; inputEl.value=""; }
    return;
  }
  if (e.key==="Enter"){
    const v = inputEl.value;
    pushHistory(v);
    inputEl.value="";
    runCommand(v);
    render();
  }
});

// Start now
startNewGame();

inputEl.focus();
