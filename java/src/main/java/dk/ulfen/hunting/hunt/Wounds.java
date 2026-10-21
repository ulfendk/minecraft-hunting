package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.species.Species;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * What a hit does to a game animal (the Java twin of scripts/wounds.js): lets it run a few steps
 * and drop, run and bleed out, or leaves it wounded with a blood trail. A dead game animal stays
 * as a carcass until it is field dressed with a knife (the hunting:knives item tag).
 */
public final class Wounds {
	private record Drop(ResourceKey<Level> dimension, Vec3 at, long until, boolean dark) {}

	private static final List<Drop> TRAILS = new ArrayList<>();
	private static final int TRAIL_TICKS = 20 * 60 * 10;
	/** Even a perfect hit runs a few metres before it goes down; so does a bleeding animal hit again. */
	public static final int LAST_RUN = 30;
	private static final DustParticleOptions BRIGHT = new DustParticleOptions(0xB01818, 0.7F);
	private static final DustParticleOptions DARK = new DustParticleOptions(0x5A0808, 0.7F);
	private static final DustParticleOptions GLOW = new DustParticleOptions(0xFF3030, 1.1F);

	private Wounds() {}

	private static int dripEvery(String blood) {
		return switch (blood) {
			case "bright", "frothy", "gills" -> 10;
			case "dark" -> 14;
			case "gut" -> 24;
			case "little" -> 40;
			default -> 0;
		};
	}

	public static void becomeCarcass(HuntTarget t, ServerLevel level, @Nullable UUID shooter, long shotId) {
		if (t.isCarcass()) return;
		Mob animal = t.mob();
		HuntState h = t.hunt();
		t.setHuntState(GameCreature.CARCASS);
		t.freezeAi();
		h.carcassSince = level.getGameTime();
		animal.removeEffect(MobEffects.SLOWNESS);
		animal.setDeltaMovement(Vec3.ZERO);
		animal.getNavigation().stop();
		animal.setTarget(null);
		animal.setHealth(animal.getMaxHealth());
		h.bleedUntil = -1;
		if (shooter != null) h.shooter = shooter;
		if (shotId != 0) h.shotId = shotId;
		if (t.deathSound() != null) level.playSound(null, animal.blockPosition(), t.deathSound(), SoundSource.NEUTRAL, 1.0F, t.voicePitch());
	}

	/** Apply an evaluated shot (scripts/wounds.js applyHit). */
	public static void applyHit(HuntTarget t, ServerLevel level, HitZones.Report r, ServerPlayer player, long shotId) {
		if (!r.hit()) {
			Senses.spook(t, level, player.position());
			return;
		}
		Mob animal = t.mob();
		HuntState h = t.hunt();
		h.grade = r.grade();
		double max = animal.getMaxHealth();
		double damage = 0;
		for (HitZones.ZoneHit z : r.zones()) damage += HuntingData.zone(z.zone()).damage() * (z.percent() / 100.0) * max * 0.6;
		boolean prev = t.huntState() == GameCreature.WOUNDED;
		if (r.fate().equals("none") && !prev) {
			Senses.spook(t, level, player.position());
			return;
		}
		boolean mortal = r.fate().equals("kill") || r.fate().equals("mortal");
		// A second wound on an already wounded animal can finish it.
		if (!mortal && (prev || r.fate().equals("wound")) && animal.getHealth() - damage <= 0) {
			becomeCarcass(t, level, player.getUUID(), shotId);
			return;
		}
		if (damage > 0) animal.setHealth((float) Math.max(1, animal.getHealth() - damage));
		level.broadcastEntityEvent(animal, (byte) 2); // red flash
		String zone = r.primaryZone();
		String blood = zone == null ? "none" : HuntingData.zone(zone).blood();
		if (!blood.equals("none")) h.blood = blood;
		else if (!prev) h.blood = "little";
		double slows = 0;
		for (HitZones.ZoneHit z : r.zones()) slows = Math.max(slows, HuntingData.zone(z.zone()).slows());
		h.slows = Math.max(h.slows, slows);
		long now = level.getGameTime();
		if (mortal) {
			long run = r.fate().equals("kill") ? LAST_RUN : Math.round(r.bleedSeconds() * 20);
			// Another good hit on a bleeding animal finishes it; it never buys it time.
			if (h.bleedUntil >= 0) run = Math.min(run, LAST_RUN);
			h.bleedUntil = h.bleedUntil >= 0 ? Math.min(h.bleedUntil, now + run) : now + run;
			h.recoverAt = -1;
		} else if (r.fate().equals("wound") && h.bleedUntil < 0) {
			h.recoverAt = now + 20 * 90;
		}
		h.shooter = player.getUUID();
		h.shotId = shotId;
		t.setHuntState(GameCreature.WOUNDED);
		Senses.spook(t, level, player.position());
	}

	/** Every tick per animal: bleeding out, dripping blood, slowing, recovering. */
	public static void tick(HuntTarget t, ServerLevel level) {
		if (t.huntState() != GameCreature.WOUNDED) return;
		Mob animal = t.mob();
		HuntState h = t.hunt();
		long now = level.getGameTime();
		int every = dripEvery(h.blood);
		if (every > 0 && now % every == 0) {
			synchronized (TRAILS) {
				TRAILS.add(new Drop(level.dimension(), new Vec3(animal.getX(), Math.floor(animal.getY()) + 0.1, animal.getZ()), now + TRAIL_TICKS,
					h.blood.equals("dark") || h.blood.equals("gut")));
				if (TRAILS.size() > 600) TRAILS.subList(0, TRAILS.size() - 600).clear();
			}
		}
		if (h.slows > 0 && now % 20 == 0) animal.addEffect(new MobEffectInstance(MobEffects.SLOWNESS, 30, h.slows > 0.5 ? 2 : 1, false, false));
		if (h.bleedUntil >= 0 && now >= h.bleedUntil) {
			becomeCarcass(t, level, h.shooter, h.shotId);
			return;
		}
		if (h.recoverAt >= 0 && now >= h.recoverAt) {
			h.recoverAt = -1;
			h.slows = 0;
			t.setHuntState(GameCreature.CALM);
		}
	}

	/** Every 2 seconds: show blood near players. Crouching makes it stand out. */
	public static void showTrails(MinecraftServer server) {
		if (server.getTickCount() % 40 != 0) return;
		long now = server.overworld().getGameTime();
		synchronized (TRAILS) {
			TRAILS.removeIf(d -> d.until() < now);
			for (ServerPlayer player : server.getPlayerList().getPlayers()) {
				for (Drop d : TRAILS) {
					if (d.dimension() != player.level().dimension() || d.at().distanceToSqr(player.position()) > 24 * 24) continue;
					DustParticleOptions dust = player.isShiftKeyDown() ? GLOW : d.dark() ? DARK : BRIGHT;
					player.level().sendParticles(player, dust, true, false, d.at().x, d.at().y, d.at().z, 2, 0.15, 0.0, 0.15, 0.0);
				}
			}
		}
	}

	public static List<Vec3> trailsNear(ServerLevel level, Vec3 at, double radius) {
		List<Vec3> out = new ArrayList<>();
		synchronized (TRAILS) {
			for (Drop d : TRAILS) if (d.dimension() == level.dimension() && d.at().distanceToSqr(at) < radius * radius) out.add(d.at());
		}
		return out;
	}

	private static double gradeFactor(String grade) {
		return switch (grade) {
			case "perfect" -> 1;
			case "good" -> 0.95;
			case "poor" -> 0.85;
			default -> 0.7;
		};
	}

	/** Use a knife on a carcass: meat, hide and the trophy. */
	public static void fieldDress(HuntTarget t, ServerLevel level, Player player, ItemStack held) {
		if (!held.is(HuntingRegistry.KNIVES)) {
			player.sendOverlayMessage(Component.translatable("hunting.dress.need_knife"));
			return;
		}
		Mob carcass = t.mob();
		HuntState h = t.hunt();
		Species s = t.species();
		Species.Game g = s.game();
		double kg = t.weightKg();
		boolean baby = carcass.isBaby();
		boolean spoiled = player instanceof ServerPlayer sp && Journal.shotNotes(sp, h.shotId).contains("meat_damage");
		for (Species.Loot l : s.loot()) {
			int n = l.min() + level.getRandom().nextInt(l.max() - l.min() + 1);
			if (spoiled && l.item().matches(".*(meat|venison|bird|fillet).*")) n /= 2;
			if (baby) n = (int) Math.ceil(n / 3.0);
			Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(l.item()));
			if (n > 0) carcass.spawnAtLocation(level, new ItemStack(item, n));
		}
		double score = 0;
		String tr = g.trophy();
		if (tr != null && !baby && (t.isMale() || tr.equals("trophy_skull") || tr.equals("trophy_tusks") || !g.maleTrophy())) {
			score = Math.round(g.score() * (0.6 + 0.8 * t.size()) * gradeFactor(h.grade) * 10) / 10.0;
			ItemStack trophy = new ItemStack(HuntingRegistry.item(tr));
			trophy.set(DataComponents.LORE, new ItemLore(List.of(
				Component.literal("★ " + score).withStyle(net.minecraft.ChatFormatting.GOLD),
				Component.literal(kg + " kg").withStyle(net.minecraft.ChatFormatting.GRAY))));
			carcass.spawnAtLocation(level, trophy);
			player.sendSystemMessage(Component.translatable("hunting.trophy.new", t.name(), String.valueOf(score)));
			level.playSound(null, player.blockPosition(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0F, 1.2F);
		}
		if (player instanceof ServerPlayer sp) Journal.recordTrophy(sp, s.id(), kg, score, h.grade, h.shotId, level.getOverworldClockTime() / 24000);
		player.sendOverlayMessage(Component.translatable("hunting.dress.done", t.name()));
		held.hurtAndBreak(1, player, EquipmentSlot.MAINHAND);
		level.playSound(null, carcass.blockPosition(), SoundEvents.SHEEP_SHEAR, SoundSource.PLAYERS, 1.0F, 1.0F);
		carcass.discard();
	}
}
