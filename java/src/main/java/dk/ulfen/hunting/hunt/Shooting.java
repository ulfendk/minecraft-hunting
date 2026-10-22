package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.species.Species;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/** Firing rifles and the shotgun (not under water): the Java twin of scripts/shooting.js. */
public final class Shooting {
	private Shooting() {}

	/** Result of tracing one projectile path. */
	public record Hit(String kind, @Nullable Entity entity, double distance, double energy, HitZones.@Nullable Report report) {}

	/** Trace one bullet/pellet: blocks along the curved path, then game animals by model shape, then anything else. */
	public static Hit trace(ServerLevel level, Vec3 eye, Vec3 dir, HuntingData.Calibre c, Wind w, @Nullable Entity shooter) {
		double blockS = c.range();
		for (double s0 = 0; s0 < c.range(); s0 += 8) {
			Vec3 p0 = Ballistics.pointAt(c, eye, dir, w, s0);
			Vec3 p1 = Ballistics.pointAt(c, eye, dir, w, Math.min(c.range(), s0 + 8));
			if (!level.isLoaded(net.minecraft.core.BlockPos.containing(p1))) {
				blockS = s0;
				break;
			}
			BlockHitResult hit = level.clip(new ClipContext(p0, p1, ClipContext.Block.COLLIDER, ClipContext.Fluid.ANY, shooter == null ? net.minecraft.world.phys.shapes.CollisionContext.empty() : net.minecraft.world.phys.shapes.CollisionContext.of(shooter)));
			if (hit.getType() != HitResult.Type.MISS) {
				blockS = s0 + p0.distanceTo(hit.getLocation());
				break;
			}
		}

		Vec3 end = eye.add(dir.scale(Math.min(blockS, c.range())));
		AABB box = new AABB(eye, end).inflate(6);
		List<HuntTarget> near = new ArrayList<>();
		Map<HuntTarget, Double> along = new LinkedHashMap<>();
		for (HuntTarget e : HuntTarget.in(level, box, HuntTarget::isLive)) {
			Vec3 v = e.mob().position().add(0, 0.6, 0).subtract(eye);
			double s = v.dot(dir);
			if (s < 0 || s > blockS + 3) continue;
			double off = v.subtract(dir.scale(s)).length();
			if (off < 4 + e.modelScale() * 2) {
				near.add(e);
				along.put(e, s);
			}
		}
		near.sort((a, b) -> Double.compare(along.get(a), along.get(b)));
		for (HuntTarget e : near) {
			Species sp = e.species();
			double s = along.get(e);
			double back = Math.max(0, s - 5);
			Vec3 p0 = Ballistics.pointAt(c, eye, dir, w, back);
			Vec3 p1 = Ballistics.pointAt(c, eye, dir, w, s + 5);
			double k = e.modelScale();
			HitZones.ModelSpace m = new HitZones.ModelSpace(e.mob().position(), e.mob().yBodyRot, k);
			double[] o = m.point(p0);
			double[] d = m.direction(p1.subtract(p0));
			HitZones.Model model = e.hitModel();
			double[] span = HitZones.intersect(model, o, d);
			if (span == null) continue;
			double distance = back + span[0] * k / 16;
			if (distance > blockS) continue;
			double energy = Ballistics.energyAt(c, distance);
			double penetration = c.penetration() * Math.sqrt(energy / c.energy());
			double minEnergy = c.isShot() ? sp.game().minShotEnergy() : c.projectile() ? 0 : sp.game().minEnergy();
			HitZones.Report r = HitZones.evaluate(model, o, d, energy, penetration, 6.25 * k, minEnergy, !sp.game().gameClass().equals("small"));
			if (r.hit()) return new Hit("game", e.mob(), distance, energy, r);
		}

		Vec3 stop = eye.add(dir.scale(blockS));
		Entity best = null;
		double bestD = Double.MAX_VALUE;
		// Not what the shooter rides (a boat, a balloon basket).
		Entity vehicle = shooter == null ? null : shooter.getVehicle();
		for (Entity e : level.getEntities(shooter, new AABB(eye, stop).inflate(1), x -> x instanceof LivingEntity && x != vehicle && HuntTarget.of(x) == null && x.isAlive() && x.isPickable())) {
			var clip = e.getBoundingBox().inflate(0.1).clip(eye, stop);
			if (clip.isPresent() && clip.get().distanceTo(eye) < bestD) {
				best = e;
				bestD = clip.get().distanceTo(eye);
			}
		}
		if (best != null) return new Hit("entity", best, bestD, Ballistics.energyAt(c, bestD), null);
		return new Hit(blockS < c.range() ? "block" : "none", null, blockS, 0, null);
	}

	private static Vec3 spread(Vec3 dir, double degrees, net.minecraft.util.RandomSource random) {
		double r = Math.toRadians(degrees);
		double a = random.nextDouble() * Math.PI * 2, m = Math.sqrt(random.nextDouble()) * r;
		Vec3 up = Math.abs(dir.y) < 0.9 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
		Vec3 u = dir.cross(up).normalize();
		Vec3 v = dir.cross(u);
		return dir.add(u.scale(Math.cos(a) * m)).add(v.scale(Math.sin(a) * m)).normalize();
	}

	private static int fateRank(String f) {
		return switch (f) {
			case "kill" -> 3;
			case "mortal" -> 2;
			case "wound" -> 1;
			default -> 0;
		};
	}

	private static int gradeRank(String g) {
		return switch (g) {
			case "perfect" -> 0;
			case "good" -> 1;
			case "poor" -> 2;
			case "unethical" -> 3;
			default -> 4;
		};
	}

	/** Shotgun: one report per animal, pellets combined. */
	private static HitZones.Report merge(List<HitZones.Report> reports) {
		HitZones.Report best = reports.getFirst();
		Map<String, Integer> zones = new LinkedHashMap<>();
		int accuracy = 0;
		for (HitZones.Report r : reports) {
			for (HitZones.ZoneHit z : r.zones()) zones.merge(z.zone(), z.percent(), (a, b) -> Math.min(100, a + b));
			if (fateRank(r.fate()) > fateRank(best.fate()) || (fateRank(r.fate()) == fateRank(best.fate()) && gradeRank(r.grade()) < gradeRank(best.grade()))) best = r;
			accuracy = Math.max(accuracy, r.accuracy());
		}
		String fate = best.fate().equals("mortal") && reports.size() >= 3 ? "kill" : best.fate();
		List<HitZones.ZoneHit> list = new ArrayList<>();
		zones.forEach((z, p) -> list.add(new HitZones.ZoneHit(z, p)));
		return best.with(list, fate, accuracy);
	}

	private static @Nullable ItemStack findAmmo(ServerPlayer player, Item ammo) {
		if (player.getOffhandItem().is(ammo)) return player.getOffhandItem();
		for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
			ItemStack s = player.getInventory().getItem(i);
			if (s.is(ammo)) return s;
		}
		return null;
	}

	/** Fire the firearm in the player's main hand. */
	public static void fire(ServerPlayer player, String firearmId) {
		ServerLevel level = player.level();
		ItemStack gun = player.getMainHandItem();
		HuntingData.Firearm f = HuntingData.FIREARMS.get(firearmId);
		if (f == null || !gun.is(HuntingRegistry.item(firearmId))) return;
		if (player.getCooldowns().isOnCooldown(gun)) {
			player.sendOverlayMessage(Component.translatable("hunting.hud.cycling"));
			return;
		}
		// Under water a firearm is useless: the powder is wet and the bullet stops in a metre.
		if (player.isEyeInFluid(net.minecraft.tags.FluidTags.WATER)) {
			player.sendOverlayMessage(Component.translatable("hunting.hud.underwater_gun"));
			level.playSound(null, player.blockPosition(), SoundEvents.DISPENSER_FAIL, SoundSource.PLAYERS, 0.6F, 0.8F);
			return;
		}
		Item ammoItem = HuntingRegistry.item(f.ammo());
		if (!player.hasInfiniteMaterials()) {
			ItemStack ammo = findAmmo(player, ammoItem);
			if (ammo == null) {
				player.sendOverlayMessage(Component.translatable("hunting.hud.no_ammo", Component.translatable(ammoItem.getDescriptionId())));
				level.playSound(null, player.blockPosition(), SoundEvents.DISPENSER_FAIL, SoundSource.PLAYERS, 0.6F, 1.4F);
				return;
			}
			ammo.shrink(1);
		}
		player.getCooldowns().addCooldown(gun, f.cycle());
		gun.hurtAndBreak(1, player, EquipmentSlot.MAINHAND);

		HuntingData.Calibre c = HuntingData.CALIBRES.get(f.calibre());
		Vec3 eye = player.getEyePosition();
		Vec3 dir = player.getViewVector(1.0F);
		Wind w = Wind.at(level.getGameTime());
		level.playSound(null, eye.x, eye.y, eye.z, SoundEvents.FIREWORK_ROCKET_BLAST, SoundSource.PLAYERS, 6.0F, c.isShot() ? 0.7F : 0.5F);
		level.playSound(null, eye.x, eye.y, eye.z, SoundEvents.GENERIC_EXPLODE.value(), SoundSource.PLAYERS, 1.2F, c.isShot() ? 1.3F : 1.7F);
		Senses.gunshot(player, c.isShot() ? 0.8 : 1);

		int pellets = Math.max(1, c.pellets());
		Map<HuntTarget, List<Hit>> perAnimal = new LinkedHashMap<>();
		for (int i = 0; i < pellets; i++) {
			Vec3 d = pellets > 1 ? spread(dir, c.spread(), level.getRandom()) : dir;
			Hit hit = trace(level, eye, d, c, w, player);
			if (hit.kind().equals("block")) {
				Vec3 p = Ballistics.pointAt(c, eye, d, w, hit.distance());
				level.sendParticles(ParticleTypes.SMOKE, p.x, p.y, p.z, 3, 0.05, 0.05, 0.05, 0.01);
			} else if (hit.kind().equals("game")) {
				HuntTarget t = HuntTarget.of(hit.entity());
				if (t != null) perAnimal.computeIfAbsent(t, k -> new ArrayList<>()).add(hit);
			} else if (hit.kind().equals("entity") && hit.entity() != null) {
				float dmg = c.isShot() ? 2 : (float) Math.min(40, hit.energy() / 150);
				hit.entity().hurtServer(level, player.damageSources().playerAttack(player), dmg);
			}
		}
		for (var e : perAnimal.entrySet()) {
			List<Hit> hits = e.getValue();
			HitZones.Report report = pellets > 1 ? merge(hits.stream().map(Hit::report).toList()) : hits.getFirst().report();
			Hit first = hits.getFirst();
			long id = Journal.recordShot(player, e.getKey(), report, first.distance(), c.name(), first.energy(), pellets, hits.size());
			Wounds.applyHit(e.getKey(), level, report, player, id);
		}
	}
}
