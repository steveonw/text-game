// Everything that draws. String builders first; then the functions that write
// them to the page, which main.js installs as the host.

import { G } from './state.js';
import { clamp } from './rng.js';
import { WORLD_SIZE } from './tuning.js';
import { STAGE_WORDS, stage } from './clock.js';
import { COMMANDS, LEGEND } from './content/pools.js';
import { trailIndexAt } from './trail.js';
import { finalTileAt, hasDogHint } from './world.js';

// ---------- Palette (LOCKED) ----------
export const COLORS = {
  "@":"#EAEAEA",".":"#6F7F6A","F":"#4E6B5A","~":"#4A6C8C","^":"#7A7A7A",
  "T":"#9C8F7A","C":"#B1A58B","R":"#6A625A","#":"#5C5C5C","!":"#8C7A6B",
  "|":"#7D6F5E","+":"#7D6F5E","I":"#8F846A","M":"#8F7E6A","S":"#7F7A6F",
  "G":"#7A7268","r":"#6A645E","t":"#556B5F","d":"#CFCFCF","w":"#8A6F5A","?":"#9A9A9A",
  "p":"#C9B896","n":"#A89880",
};

// ---------- UI / rendering ----------
export function escapeHtml(s){ return String(s).replace(/[&<>\"\']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#39;" }[m])); }

export function glyphSpan(ch){
  const col = COLORS[ch] || "#e6e6e6";
  return '<span style="color:'+col+'">'+escapeHtml(ch)+'</span>';
}

// v13's renderLegend().
// M6: the legend follows the mode. Local T is a temple and local ^ a rock.
export function legendItems(){
  const key = (G.mode === "LOCAL" && G.local) ? G.local.kind : "WORLD";
  return LEGEND[key] || LEGEND.WORLD;
}

export function legendHtml(){
  return legendItems().map(([sym,name])=>{
    const col = COLORS[sym] || "#fff";
    return '<span class="chip"><i class="dot" style="background:'+col+'"></i><span>'+escapeHtml(sym)+' '+escapeHtml(name)+'</span></span>';
  }).join("");
}

export function drawLegend(){
  document.getElementById("legend").innerHTML = legendHtml();
}

// M6: what the map's aria-label says: the mode and the position.
export function mapLabel(){
  if (G.mode === "LOCAL" && G.local){
    const name = ({TOWN:"Town", WILD:"Wild", RUIN:"Ruins"})[G.local.kind] || "Local";
    return name + " map, at " + G.local.tx + ", " + G.local.ty + ". You are at " + G.local.px + ", " + G.local.py + ".";
  }
  return "World map. You are at " + G.player.x + ", " + G.player.y + ".";
}

// The side panel's command list: the same table HELP reads.
export function commandsHtml(){
  return COMMANDS.map(([cmd, what]) => '<div><span class="kbd">'+escapeHtml(cmd)+'</span> '+escapeHtml(what)+'</div>').join("");
}

// Found sign is drawn as ? on plains and forest. Towns, the capital, ruins and closed
// roads keep their own glyph. A hint bit off the trail can only come from a code saved
// by v13, whose "near" tiles were not a trail; it is kept but not drawn.
export function worldGlyph(x,y){
  const g = finalTileAt(x,y);
  if ((g==="." || g==="F") && hasDogHint(x,y) && trailIndexAt(x,y) >= 0) return "?";
  return g;
}

export function renderMapWorld(){
  let html = "";
  for (let y=0;y<WORLD_SIZE;y++){
    for (let x=0;x<WORLD_SIZE;x++){
      html += glyphSpan((x===G.player.x && y===G.player.y) ? "@" : worldGlyph(x,y));
    }
    html += "\n";
  }
  return html;
}

export function renderMapLocal(){
  let html = "";
  // Build NPC position lookup
  const npcAt = {};
  if (G.local.npcs) {
    for (const npc of G.local.npcs) {
      npcAt[npc.x + "_" + npc.y] = npc.type;
    }
  }

  for (let y=0;y<G.local.size;y++){
    for (let x=0;x<G.local.size;x++){
      const key = x + "_" + y;
      if (x===G.local.px && y===G.local.py) {
        html += glyphSpan("@");
      } else if ((G.local.kind==="WILD" || G.local.kind==="RUIN") && G.local.dog && x===G.local.dog.x && y===G.local.dog.y) {
        html += glyphSpan("d");
      } else if (npcAt[key] === "n") {
        // Show townsperson/wanderer as 'p'
        html += glyphSpan("p");
      } else if (npcAt[key] && npcAt[key] !== "w" && "IMSTG".includes(npcAt[key])) {
        // Show building NPCs - render the building but they know someone's there
        html += glyphSpan(G.local.map[y][x]);
      } else {
        html += glyphSpan(G.local.map[y][x]);
      }
    }
    html += "\n";
  }
  return html;
}

// The three strings the page shows beside the log. Pure: tests read them without a page.
export function mapHtml(){
  if (G.mode==="END") return "";
  else if (G.mode==="WORLD") return renderMapWorld();
  else return renderMapLocal();
}

export function posText(){
  return (G.mode==="WORLD") ? ("("+G.player.x+","+G.player.y+") • seed "+(G.seed|0)) : (G.local ? (G.local.kind+" @ ("+G.local.tx+","+G.local.ty+") • seed "+(G.seed|0)) : "");
}

export function statusText(){
  const fat = ["fresh","worn","tired","heavy","spent","near-done"][clamp(G.player.fatigue,0,5)];
  return "Fatigue: "+fat+" • Roads: "+STAGE_WORDS[stage()]+" • Steps: "+G.steps;
}

// v13's render(): redraw the labels, the map and the status line from G.
export function renderPage(){
  document.getElementById("modeLabel").textContent = G.mode;
  document.getElementById("posLabel").textContent = posText();

  const mapOut = document.getElementById("mapOut");
  mapOut.innerHTML = mapHtml();
  mapOut.setAttribute("aria-label", mapLabel());
  drawLegend();
  const cmds = document.getElementById("commands");
  if (cmds && !cmds.innerHTML) cmds.innerHTML = commandsHtml();

  document.getElementById("statusLine").textContent = statusText();

  const l = document.getElementById("log");
  l.scrollTop = l.scrollHeight;
}

// ---------- Log ----------
// v13's log(): append one line to the page's log.
export function appendLine(text, cls){
  const div = document.getElementById("log");
  const p = document.createElement("p");
  p.className = "line";
  if (cls==="m") p.innerHTML = '<span class="m">'+escapeHtml(text)+'</span>';
  else p.textContent = text;
  div.appendChild(p);
  // cap log lines
  while (div.children.length > 300) div.removeChild(div.firstChild);
  div.scrollTop = div.scrollHeight;
}

// v13's clearLogSoft().
export function clearLines(){
  document.getElementById("log").innerHTML = "";
}
