// Hit zones: what happens when a bullet, pellet, arrow or harpoon passes through a part of an animal.
// Shared by the Bedrock scripts (via scripts/data.js), the Java mod (via species.json),
// the x-ray images and the website.
//
//   fate      kill      goes down after a last few steps (wounds.js LAST_RUN)
//             mortal    runs, bleeds out after `bleedSeconds`
//             wound     runs, bleeds a little, recovers unless shot again
//             none      no effect (antlers, a feather)
//   vital     counts towards the accuracy score
//   density   how much penetration a centimetre of this tissue uses up (bone > muscle > lungs)
//   color     x-ray colour

export const ZONES = {
  brain: { name: 'Brain', fate: 'kill', bleedSeconds: 0, damage: 1.0, density: 1.6, vital: true, color: '#f2e6b8', blood: 'none' },
  spine: { name: 'Spine', fate: 'kill', bleedSeconds: 0, damage: 1.0, density: 2.2, vital: true, color: '#fff7e0', blood: 'none' },
  heart: { name: 'Heart', fate: 'mortal', bleedSeconds: 3, damage: 0.9, density: 1.0, vital: true, color: '#d8242c', blood: 'bright' },
  lungs: { name: 'Lungs', fate: 'mortal', bleedSeconds: 6, damage: 0.7, density: 0.5, vital: true, color: '#f07c8c', blood: 'frothy' },
  gills: { name: 'Gills', fate: 'mortal', bleedSeconds: 4, damage: 0.7, density: 0.5, vital: true, color: '#e0566a', blood: 'gills' },
  liver: { name: 'Liver', fate: 'mortal', bleedSeconds: 45, damage: 0.5, density: 1.0, vital: false, color: '#7a1f2a', blood: 'dark' },
  stomach: { name: 'Stomach', fate: 'mortal', bleedSeconds: 150, damage: 0.3, density: 0.8, vital: false, color: '#7a9a3a', blood: 'gut' },
  shoulder: { name: 'Shoulder', fate: 'wound', bleedSeconds: 0, damage: 0.35, density: 2.0, vital: false, color: '#c9b48a', blood: 'little', slows: 0.5 },
  neck: { name: 'Neck', fate: 'wound', bleedSeconds: 0, damage: 0.35, density: 1.0, vital: false, color: '#b07a6a', blood: 'little' },
  ham: { name: 'Hindquarter', fate: 'wound', bleedSeconds: 0, damage: 0.3, density: 1.2, vital: false, color: '#9a5a4a', blood: 'little', slows: 0.6 },
  muscle: { name: 'Muscle', fate: 'wound', bleedSeconds: 0, damage: 0.2, density: 1.0, vital: false, color: '#a86a5a', blood: 'little' },
  jaw: { name: 'Jaw', fate: 'wound', bleedSeconds: 0, damage: 0.25, density: 1.6, vital: false, color: '#c9a07a', blood: 'little' },
  leg: { name: 'Leg', fate: 'wound', bleedSeconds: 0, damage: 0.25, density: 1.8, vital: false, color: '#b08868', blood: 'little', slows: 0.55 },
  antler: { name: 'Antler', fate: 'none', bleedSeconds: 0, damage: 0, density: 2.5, vital: false, color: '#e8dcc0', blood: 'none' },
  tail: { name: 'Tail', fate: 'none', bleedSeconds: 0, damage: 0.05, density: 0.5, vital: false, color: '#d0b090', blood: 'none' },
};

/** When a ray passes through overlapping zones, the first in this list wins. */
export const ZONE_PRIORITY = ['brain', 'spine', 'heart', 'lungs', 'gills', 'liver', 'stomach', 'shoulder', 'ham', 'neck', 'jaw', 'leg', 'antler', 'tail', 'muscle'];

/** Shot grades, best first. */
export const GRADES = {
  perfect: { name: 'Perfect shot', color: '§a' },
  good: { name: 'Good shot', color: '§2' },
  poor: { name: 'Poor shot', color: '§6' },
  unethical: { name: 'Unethical shot', color: '§c' },
  miss: { name: 'Miss', color: '§7' },
};

/** Blood trail descriptions shown in the report and when tracking. */
export const BLOOD = {
  none: 'No blood',
  bright: 'Bright red blood',
  frothy: 'Pink, frothy blood',
  dark: 'Dark red blood',
  gut: 'Dark blood with stomach contents',
  little: 'A few drops of blood',
  gills: 'A cloud of bright red blood',
};
