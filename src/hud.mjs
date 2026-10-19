// Bedrock HUD overlays (scope and x-ray) are switched on by the title text. The scripts
// set a title made only of formatting codes, which shows nothing on screen, and
// ui/hud_screen.json shows the overlay whose code is in the title.
import { NS } from './lib/constants.mjs';

// Formatting codes that draw nothing on their own.
export const HUD_CHARS = '0123456789abcdefghijmnpqstu';
const CH = HUD_CHARS;
export const SCOPE_PREFIX = '§s§c§o';
export const XRAY_PREFIX = '§m§n§p';

export const scopeCode = (rifle, zoom) => `${SCOPE_PREFIX}§${CH[rifle]}§${CH[zoom]}`;
export const xrayCode = (species, zone) => `${XRAY_PREFIX}§${CH[species]}§${CH[zone]}`;

const contains = (code) => `(not ((#hud_title_text_string - '${code}') = #hud_title_text_string))`;

function overlay(name, code, extra) {
  return {
    [name]: {
      type: 'panel',
      size: ['100%', '100%'],
      bindings: [
        { binding_name: '#hud_title_text_string' },
        { binding_type: 'view', source_property_name: contains(code), target_property_name: '#visible' },
      ],
      ...extra,
    },
  };
}

/**
 * ui/hud_screen.json. `scopes` = [{ rifle, zoom, texture }], `xrays` = [{ species, zone, texture }]
 * with indexes matching scopeCode/xrayCode.
 */
export function hudScreen(scopes, xrays) {
  const out = {
    namespace: 'hud',
    root_panel: {
      modifications: [{
        array_name: 'controls',
        operation: 'insert_front',
        value: [{ [`${NS}_overlays@hud.${NS}_overlays`]: {} }],
      }],
    },
    [`${NS}_overlays`]: {
      type: 'panel',
      size: ['100%', '100%'],
      controls: [
        ...scopes.map((s) => ({ [`${NS}_scope_${s.rifle}_${s.zoom}@hud.${NS}_scope_${s.rifle}_${s.zoom}`]: {} })),
        ...xrays.map((x) => ({ [`${NS}_xray_${x.species}_${x.zone}@hud.${NS}_xray_${x.species}_${x.zone}`]: {} })),
      ],
    },
  };
  for (const s of scopes) {
    Object.assign(out, overlay(`${NS}_scope_${s.rifle}_${s.zoom}`, scopeCode(s.rifle, s.zoom), {
      controls: [
        { left: { type: 'image', texture: `textures/ui/${NS}/black`, anchor_from: 'left_middle', anchor_to: 'left_middle', size: ['50%-50%y+1px', '100%'] } },
        { right: { type: 'image', texture: `textures/ui/${NS}/black`, anchor_from: 'right_middle', anchor_to: 'right_middle', size: ['50%-50%y+1px', '100%'] } },
        { lens: { type: 'image', texture: s.texture, anchor_from: 'center', anchor_to: 'center', size: ['100%y', '100%'] } },
      ],
    }));
  }
  for (const x of xrays) {
    Object.assign(out, overlay(`${NS}_xray_${x.species}_${x.zone}`, xrayCode(x.species, x.zone), {
      controls: [{
        image: {
          type: 'image', texture: x.texture, anchor_from: 'top_middle', anchor_to: 'top_middle',
          offset: [0, 8], size: ['64%y', '32%y'], layer: 5,
        },
      }],
    }));
  }
  return out;
}
