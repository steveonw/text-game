// The endings and the numbers on the ending screen.

import { G } from './state.js';
import { clearLogSoft, log, render } from './io.js';
import { OPEN_GATE } from './content/pools.js';
import { trail } from './trail.js';
import { hasDogHint } from './world.js';
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
    // The Open Gate (M6): the roads changed before the dog was found.
    log("", "m");
    for (const line of OPEN_GATE) log(line, "m");
    log("", "m");
    log("THE QUIET ROADS", "m");
    log("Ending: The Open Gate", "m");
  }

  // M6: true numbers. v13's "Towns visited" counted remembered building staff (D15).
  log("", "m");
  log("Steps taken: " + G.steps, "m");
  log("Towns entered: " + townsEntered() + " of " + G.towns.length, "m");
  log("People spoken to: " + Object.keys(G.npcMemory).length, "m");
  log("Sign found: " + signFound() + " of " + trail().tiles.length, "m");
  log("", "m");
  log("(NEW <seed> to begin again)", "m");

  render();
}

// Towns the player has ENTERed: bits of G.townsEntered, one per entry of G.towns.
export function townsEntered(){
  let n = 0;
  for (let i = 0; i < G.towns.length; i++) if (G.townsEntered & (1 << i)) n++;
  return n;
}

// Trail tiles the player has stood on.
export function signFound(){
  let n = 0;
  for (const t of trail().tiles) if (hasDogHint(t.x, t.y)) n++;
  return n;
}
