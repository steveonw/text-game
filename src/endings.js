// The endings and the numbers on the ending screen.

import { G } from './state.js';
import { clearLogSoft, log, render } from './io.js';
import { ROADS_CHANGED } from './content/pools.js';
import { TUNE } from './tuning.js';

export function triggerEnding(type){
  G.mode = "END";
  clearLogSoft();

  const fallen = G.worldEvents.has("capital_fallen");
  const war = G.worldEvents.has("war_started");
  const hints = G.dogHintCount;

  if (type === "reunion"){
    log("", "m");
    log("The dog looks up.", "m");
    log("", "m");

    if (fallen){
      // Bittersweet ending - found the dog but the world collapsed
      log("It's thinner than you remember.", "m");
      log("The roads behind you are quieter now.", "m");
      log("But it came when you called.", "m");
      log("", "m");
      log("You walk home together.", "m");
      log("What's left of it.", "m");
      log("", "m");
      log("THE QUIET ROADS", "m");
      log("Ending: The Long Way Back", "m");
    } else if (war){
      // Tense ending - found dog during wartime
      log("Dust on its coat. Burrs in its fur.", "m");
      log("It's been through something.", "m");
      log("So have you.", "m");
      log("", "m");
      log("The roads aren't safe anymore.", "m");
      log("But you're not walking them alone.", "m");
      log("", "m");
      log("THE QUIET ROADS", "m");
      log("Ending: Found in Time", "m");
    } else if (hints >= TUNE.homecomingHints && G.player.rep >= TUNE.homecomingReputation){
      // Best ending - patient search, built relationships
      log("It bounds toward you.", "m");
      log("No hesitation. It remembers.", "m");
      log("", "m");
      log("People helped you find your way.", "m");
      log("The roads were kind.", "m");
      log("", "m");
      log("You walk home together.", "m");
      log("The gate is still open.", "m");
      log("", "m");
      log("THE QUIET ROADS", "m");
      log("Ending: Homecoming", "m");
    } else {
      // Standard ending
      log("It approaches slowly. Sniffs your hand.", "m");
      log("Then presses against your leg.", "m");
      log("", "m");
      log("The search is over.", "m");
      log("The roads continue without you.", "m");
      log("", "m");
      log("THE QUIET ROADS", "m");
      log("Ending: Reunion", "m");
    }
  }

  if (type === "changed"){
    // The Open Gate: the roads changed before the dog was found.
    // PLACEHOLDER until M6 writes this ending. One line stands in for it.
    log("", "m");
    log(ROADS_CHANGED, "m");
    log("", "m");
    log("THE QUIET ROADS", "m");
    log("Ending: The Open Gate", "m");
  }

  log("", "m");
  log("Steps taken: " + G.steps, "m");
  log("Towns visited: " + countVisitedTowns(), "m");
  log("People spoken to: " + Object.keys(G.npcMemory).length, "m");
  log("", "m");
  log("(NEW <seed> to begin again)", "m");

  render();
}

export function countVisitedTowns(){
  let count = 0;
  for (const id of Object.keys(G.npcMemory)){
    if (id.startsWith("npc_") && !id.includes("ambient")) count++;
  }
  return Math.min(count, G.towns.length);
}
