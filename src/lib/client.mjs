// Animal spec -> Bedrock resource-pack files (client entity, render controller,
// animation controllers, sound mappings).
import { NS } from './constants.mjs';

const anim = (id, name) => `animation.hunting.${id}.${name}`;

/**
 * Locomotion/posture state machine. States are listed by priority; a state is
 * entered as soon as its condition is true and left when it becomes false.
 */
function moveController(a, available) {
  const run = a.client?.runSpeed ?? 5;
  const candidates = [
    ...(a.game ? [{ name: 'dead', anim: 'dead', cond: "query.property('hunting:state') == 4" }] : []),
    { name: 'sleeping', anim: 'sleep', cond: 'query.is_sleeping' },
    ...(a.game ? [{ name: 'alert', anim: 'alert', cond: "query.property('hunting:state') == 1 && query.ground_speed < 0.4" }] : []),
    { name: 'flying', anim: 'fly', cond: '!query.is_on_ground && !query.is_in_water' },
    { name: 'swimming', anim: 'swim', cond: 'query.is_in_water' },
    { name: 'sitting', anim: 'sit', cond: 'query.is_sitting' },
    { name: 'eating', anim: 'eat', cond: 'query.is_grazing' },
    { name: 'running', anim: 'run', cond: `query.ground_speed > ${run}` },
    { name: 'walking', anim: 'walk', cond: 'query.ground_speed > 0.4' },
    ...(a.client?.extraStates ?? []),
  ].filter((s) => available.has(s.anim));

  const states = {
    default: {
      animations: (a.client?.idle ?? ['idle']).filter((n) => available.has(n)),
      transitions: candidates.map((s) => ({ [s.name]: s.cond })),
      blend_transition: 0.2,
    },
  };
  candidates.forEach((s, i) => {
    states[s.name] = {
      animations: [s.anim],
      transitions: [
        ...candidates.slice(0, i).map((o) => ({ [o.name]: o.cond })),
        { default: `!(${s.cond})` },
      ],
      blend_transition: 0.2,
    };
  });
  return { initial_state: 'default', states };
}

export function buildAnimationControllers(a, animNames) {
  const available = new Set(animNames);
  const controllers = {
    [`controller.animation.hunting.${a.id}.move`]: moveController(a, available),
  };
  if (available.has('attack')) {
    controllers[`controller.animation.hunting.${a.id}.attack`] = {
      initial_state: 'default',
      states: {
        default: { transitions: [{ attacking: 'variable.attack_time > 0' }] },
        attacking: { animations: ['attack'], transitions: [{ default: 'query.all_animations_finished' }] },
      },
    };
  }
  return { format_version: '1.10.0', animation_controllers: controllers };
}

export function buildClientEntity(a, animNames, egg) {
  const textures = { default: `textures/entity/${NS}/${a.id}` };
  (a.variants ?? []).forEach((v, i) => {
    if (v.texture) textures[`v${i}`] = `textures/entity/${NS}/${a.id}_${v.texture}`;
  });
  const animations = Object.fromEntries(animNames.map((n) => [n, anim(a.id, n)]));
  const hasHead = a.model.bones.some((b) => b.name === 'head');
  if (hasHead) animations.look_at_target = 'animation.hunting.common.look_at_target';
  animations.move_controller = `controller.animation.hunting.${a.id}.move`;
  const animate = ['move_controller'];
  if (animNames.includes('attack')) {
    animations.attack_controller = `controller.animation.hunting.${a.id}.attack`;
    animate.push('attack_controller');
  }
  if (hasHead) animate.push({ look_at_target: a.game ? "!query.is_sleeping && query.property('hunting:state') != 4" : '!query.is_sleeping' });

  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${a.id}`,
        materials: { default: 'entity_alphatest' },
        textures,
        geometry: { default: `geometry.hunting.${a.id}` },
        animations,
        scripts: { animate, ...(a.scale && a.scale !== 1 ? { scale: String(a.scale) } : {}) },
        render_controllers: [`controller.render.hunting.${a.id}`],
        spawn_egg: { base_color: egg[0], overlay_color: egg[1] },
        enable_attachables: false,
      },
    },
  };
}

export function buildRenderController(a, boneNames) {
  const variantTextures = (a.variants ?? []).map((v) => (v.texture ? `Texture.v${(a.variants ?? []).indexOf(v)}` : 'Texture.default'));
  const rc = {
    geometry: 'Geometry.default',
    materials: [{ '*': 'Material.default' }],
    textures: variantTextures.length ? ['Array.skins[query.variant]'] : ['Texture.default'],
  };
  if (variantTextures.length) rc.arrays = { textures: { 'Array.skins': variantTextures } };

  // Bones that only show up in some situations.
  const vis = [];
  if (boneNames.includes('saddle')) vis.push({ saddle: 'query.is_saddled' });
  if (boneNames.includes('chest')) vis.push({ chest: 'query.is_chested' });
  for (const bone of a.maleBones ?? []) vis.push({ [bone]: 'query.variant == 0 && !query.is_baby' });
  for (const bone of a.tameBones ?? []) vis.push({ [bone]: 'query.is_tamed' });
  for (const [bone, cond] of Object.entries(a.client?.visibility ?? {})) {
    if (boneNames.includes(bone)) vis.push({ [bone]: cond });
  }
  if (vis.length) rc.part_visibility = [{ '*': true }, ...vis];

  return { format_version: '1.8.0', render_controllers: { [`controller.render.hunting.${a.id}`]: rc } };
}

/** Entity sound events mapped onto vanilla sounds with a per-species pitch. */
export function buildEntitySounds(a) {
  const s = a.sounds ?? {};
  const events = {};
  for (const key of ['ambient', 'hurt', 'death', 'step', 'attack', 'eat', 'breathe', 'warn']) {
    if (s[key]) events[key] = s[key];
  }
  return {
    volume: s.volume ?? 1.0,
    pitch: s.pitch ?? [0.9, 1.1],
    events,
  };
}
