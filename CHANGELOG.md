# Changelog

## [0.3.3] - 2026-10-21
Hit animals, for Bedrock and Java (Fabric):
- A good hit is enough: shooting an animal that is already bleeding out no longer restarts its clock (before, every follow-up shot kept it alive longer). Now a second good hit brings it down after a few more steps.
- Heart, lung and gill shots go down sooner: about 3 s for the heart, 6 s for the lungs (4 s through both), 4 s for the gills.
- Every hit animal runs: even a brain or spine shot, or a close load of shot, lets it take a few last steps (about 1.5 s) before it drops.
- Bedrock: an animal that ran out of the simulation distance, or was hit before the world was reloaded, no longer stays wounded for ever; it goes down once it is loaded again.

## [0.3.2] - 2026-10-20
Fixes, for Bedrock:
- The x-ray (and the scope) no longer stays on screen as a dark rectangle after it should have gone away.

## [0.3.1] - 2026-10-20
Fixes, for Bedrock:
- The x-ray button in the journal now shows the x-ray: a species page shows the whole animal, and a shot report whose hit zone has no picture of its own does too (before, the species page just went back to the list).
- The guide says how to lower the scope.

## [0.3.0] - 2026-10-20
Safari animals and dinosaurs as game, for Bedrock and Java (Fabric):
- With Safari Animals (0.8.0 or later) or Prehistoric Dinosaurs (0.7.0 or later) installed too, all 41 safari animals and 62 prehistoric creatures are game. Each has organs in its own model, a weight, a minimum calibre and a trophy. A broadside heart shot grades perfect; elephants, hippos and the biggest dinosaurs need a .338.
- They're spooked and flee like our game, bleed, become carcasses to field dress for their own meat and hides, show up in the shot report and the journal, and the hunting dog tracks them.
- Other add-ons can do the same: see "Hunting targets for other add-ons" in the README.

## [0.2.0] - 2026-10-19
Hunting under water, for Bedrock and Java (Fabric):
- Three game fish: sea bass (schools in coastal seas), bluefin tuna (deep oceans) and the porbeagle shark (cold and deep water; it turns on a bleeding diver). Fish have gills in the hit zones, flee through the water and float up when dead.
- Speargun (hold use to load a harpoon bolt, use to fire) and hand harpoon (hold and let go to throw, pick it up again). Harpoons keep their speed under water and are weak through the air.
- The harpoon line: a speared fish is held on a line. Hold sneak to reel it in; big fish fight, and a line held too tight for too long snaps.
- Dive knife: cuts harder under water, and any knife now field dresses.
- Snorkel, dive mask, scuba tank (15 minutes of air, refills at the surface) and dive fins.
- Mini submarine: battery powered (charge it with redstone), steers where you look, lamps in the deep, and a harpoon launcher with a winch.
- Firearms no longer fire under water.

## [0.1.0] - 2026-10-19
First release, for Bedrock and Java (Fabric):
- 12 game species (white-tailed deer, red deer, roe deer, moose, wild boar, black bear, grey wolf, red fox, hare, pheasant, mallard, wild turkey) and a tameable hunting dog.
- Game sees, hears and smells you. Animals freeze when they notice you and bolt with their herd when spooked. Gunshots carry far.
- Wind that turns and gusts, carries your scent and drifts long shots. Check it with a wind checker.
- Four scoped rifles (.243, .308, .30-06, .338 Magnum) with three zoom levels, sway, breath holding, bullet drop and holdover marks, plus a shotgun and a compound bow.
- Shots are traced against each animal's shape and organs. The x-ray shot report shows entry, exit, organs hit, accuracy, energy and a perfect, good, poor or unethical grade.
- Wounded animals bleed and leave a blood trail. A shot animal becomes a carcass to field dress with a hunting knife for meat, hide and a scored trophy.
- Gear: binoculars with range finder, game calls, scent eliminator, ghillie suit, camouflage netting and tree stands.
- The Hunting Journal keeps your shot reports, trophy log and a guide to the game you've seen.
