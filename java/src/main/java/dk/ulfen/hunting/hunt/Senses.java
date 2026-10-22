package dk.ulfen.hunting.hunt;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.species.Species;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

/**
 * How game animals notice hunters: sight, hearing and smell build up awareness. The Java twin
 * of scripts/senses.js (same thresholds and numbers).
 */
public final class Senses {
	public static final double ALERT = 30, FLEE = 75;
	private static final Map<UUID, double[]> NOISE = new ConcurrentHashMap<>(); // radius, until (game time)

	private Senses() {}

	/** A loud event (a gunshot, a block breaking) heard by everything within `radius`. */
	public static void makeNoise(Player player, double radius, int ticks) {
		long now = player.level().getGameTime();
		double[] n = NOISE.get(player.getUUID());
		if (n == null || n[1] < now || n[0] < radius) NOISE.put(player.getUUID(), new double[] {radius, now + ticks});
	}

	public static double concealment(Player player) {
		double k = 1;
		int pieces = 0;
		for (EquipmentSlot slot : new EquipmentSlot[] {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) {
			if (HuntingRegistry.GHILLIE.contains(player.getItemBySlot(slot).getItem())) pieces++;
		}
		k *= 1 - 0.14 * pieces;
		if (inHide(player)) k *= 0.25;
		if (onTreeStand(player)) k *= 0.35;
		return k;
	}

	public static boolean inHide(Player player) {
		BlockPos p = player.blockPosition();
		int nets = 0;
		for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) for (int dy = 0; dy <= 1; dy++) {
			if (player.level().getBlockState(p.offset(dx, dy, dz)).is(HuntingRegistry.CAMO_NETTING) && ++nets >= 3) return true;
		}
		return false;
	}

	public static boolean onTreeStand(Player player) {
		BlockPos feet = BlockPos.containing(player.getX(), player.getY() - 0.1, player.getZ());
		if (!player.level().getBlockState(feet).is(HuntingRegistry.TREE_STAND)) return false;
		for (int d = 2; d <= 4; d++) {
			if (!player.level().getBlockState(player.blockPosition().below(d)).isAir()) return d >= 4;
		}
		return true;
	}

	private static double scentFactor(Player player) {
		long until = player.getAttachedOrElse(HuntingRegistry.SCENT_UNTIL, 0L);
		return until > player.level().getGameTime() ? 0.25 : 1;
	}

	private record Movement(double sight, double noise) {}

	private static Movement movement(Player p) {
		// Riding an aircraft from the Flights mod (the hot-air balloon): still, unless the burner roars.
		var vehicle = p.getVehicle();
		if (vehicle != null && "flights".equals(net.minecraft.world.entity.EntityType.getKey(vehicle.getType()).getNamespace())) {
			return new Movement(0.35, vehicle.entityTags().contains("flights.burner") ? 10 : 0);
		}
		Vec3 v = p.getDeltaMovement();
		double speed = Math.hypot(v.x, v.z);
		if (p.isSprinting()) return new Movement(1.6, 28);
		if (speed > 0.03) return p.isShiftKeyDown() ? new Movement(0.45, 3) : new Movement(1.0, 12);
		return p.isShiftKeyDown() ? new Movement(0.2, 0) : new Movement(0.35, 0);
	}

	private static double lineOfSight(ServerLevel level, Mob animal, Vec3 eye, Player player) {
		BlockHitResult hit = level.clip(new ClipContext(eye, player.getEyePosition(), ClipContext.Block.COLLIDER, ClipContext.Fluid.NONE, animal));
		if (hit.getType() == HitResult.Type.MISS) return 1;
		return level.getBlockState(hit.getBlockPos()).getBlock() instanceof LeavesBlock ? 0.35 : 0;
	}

	/** Awareness gained this step from one player. */
	public static double sense(ServerLevel level, Mob animal, Species.Senses s, Player player, Wind w) {
		Vec3 head = animal.getEyePosition();
		Vec3 p = player.position();
		double d = head.distanceTo(p);
		if (d > 140) return 0;
		Movement move = movement(player);
		double hidden = concealment(player);
		double gain = 0;

		// Short under water.
		double sightRange = animal.isInWater() ? Math.min(20, 72 * s.sight()) : 72 * s.sight();
		if (d < sightRange) {
			Vec3 view = animal.getViewVector(1.0F);
			Vec3 to = p.subtract(head).normalize();
			if (view.dot(to) > -0.25 || d < 6) {
				double los = lineOfSight(level, animal, head, player);
				if (los > 0) {
					double light = level.isBrightOutside() ? 1 : 0.45;
					gain += 45 * s.sight() * move.sight() * hidden * los * light * Math.pow(1 - d / sightRange, 2);
				}
			}
		}

		double[] n = NOISE.get(player.getUUID());
		double loud = Math.max(move.noise() + (player.getDeltaMovement().y > 0.1 && !player.onGround() ? 8 : 0), n != null && n[1] >= level.getGameTime() ? n[0] : 0);
		double hearRange = loud * s.hearing();
		if (hearRange > 0 && d < hearRange) gain += 35 * s.hearing() * (1 - d / hearRange);

		double scent = scentFactor(player) * (onTreeStand(player) ? 0.4 : 1);
		Vec3 toAnimal = new Vec3(head.x - p.x, 0, head.z - p.z).normalize();
		double wn = w.speed() > 0.5 ? (toAnimal.x * w.x() + toAnimal.z * w.z()) / w.speed() : 0.6;
		double smellRange = (10 + 5 * w.speed()) * s.smell() * scent;
		if (wn > 0.5 && d < smellRange) gain += 60 * s.smell() * wn * (1 - d / smellRange);
		return gain;
	}

	/** Make an animal bolt away from `from` (and its herd with it). */
	public static void spook(HuntTarget t, ServerLevel level, Vec3 from) {
		spook(t, level, from, true);
	}

	private static void spook(HuntTarget t, ServerLevel level, Vec3 from, boolean cascade) {
		if (t.isCarcass()) return;
		Mob animal = t.mob();
		Species s = t.species();
		HuntState h = t.hunt();
		h.awareness = Math.max(h.awareness, FLEE + 5);
		h.fleeUntil = level.getGameTime() + (long) (s.senses().alertTime() * 30);
		h.fleeFrom = from;
		if (t.huntState() != GameCreature.WOUNDED) t.setHuntState(GameCreature.FLEE);
		animal.removeEffect(MobEffects.SLOWNESS);
		animal.getNavigation().stop();
		if (!cascade || s.senses().herd() <= 0) return;
		for (HuntTarget other : HuntTarget.in(level, animal.getBoundingBox().inflate(s.senses().herd()), o -> o.mob() != animal && o.mob().getType() == animal.getType() && o.huntState() < GameCreature.FLEE)) {
			spook(other, level, from, false);
		}
	}

	/** A gunshot: everything within earshot is startled; close animals bolt. */
	public static void gunshot(ServerPlayer player, double loudness) {
		ServerLevel level = player.level();
		makeNoise(player, 120 * loudness, 30);
		double range = 140 * loudness;
		for (HuntTarget e : HuntTarget.in(level, player.getBoundingBox().inflate(range), a -> !a.isCarcass())) {
			double d = e.mob().position().distanceTo(player.position());
			if (d > range) continue;
			e.hunt().awareness += 30 + 70 * Math.max(0, 1 - d / (120 * loudness));
			if (e.hunt().awareness >= FLEE) spook(e, level, player.position());
		}
	}

	/** Every 10 ticks per animal (GameAnimal.aiStep, ForeignTargets). */
	public static void step(HuntTarget t, ServerLevel level) {
		Mob animal = t.mob();
		HuntState h = t.hunt();
		Species.Senses s = t.species().senses();
		if (s == null) return;
		int st = t.huntState();
		Wind w = Wind.at(level.getGameTime());
		double gain = 0;
		Player source = null;
		for (Player player : level.players()) {
			if (player.isSpectator() || player.distanceToSqr(animal) > 140 * 140) continue;
			double g = sense(level, animal, s, player, w);
			if (g > gain) {
				gain = g;
				source = player;
			}
		}
		h.awareness = Math.max(0, Math.min(120, h.awareness + gain - (gain > 0 ? 0 : 6)));
		long now = level.getGameTime();
		if (st == GameCreature.WOUNDED) return;
		if (st == GameCreature.FLEE) {
			if (now >= h.fleeUntil) {
				h.awareness = 20;
				t.setHuntState(GameCreature.CALM);
			}
			return;
		}
		if (h.awareness >= FLEE) {
			spook(t, level, source != null ? source.position() : animal.position());
		} else if (h.awareness >= ALERT) {
			if (st != GameCreature.ALERT) {
				t.setHuntState(GameCreature.ALERT);
				if (t.warnSound() != null) level.playSound(null, animal.blockPosition(), t.warnSound(), SoundSource.NEUTRAL, 1.2F, t.voicePitch() * 0.8F);
				t.playAction("stamp");
			}
			if (source != null) animal.getLookControl().setLookAt(source, 30, 30);
			animal.addEffect(new MobEffectInstance(MobEffects.SLOWNESS, 14, 8, false, false));
		} else if (st == GameCreature.ALERT && h.awareness < ALERT / 2) {
			t.setHuntState(GameCreature.CALM);
		}
	}
}
