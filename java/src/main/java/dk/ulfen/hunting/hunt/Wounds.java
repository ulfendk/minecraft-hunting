package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameAnimal;
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
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * What a hit does to a game animal (the Java twin of scripts/wounds.js): drops it on the spot,
 * lets it run and bleed out, or leaves it wounded with a blood trail. A dead game animal stays
 * as a carcass until it is field dressed with a knife (the hunting:knives item tag).
 */
public final class Wounds {
	private record Drop(ResourceKey<Level> dimension, Vec3 at, long until, boolean dark) {}

	private static final List<Drop> TRAILS = new ArrayList<>();
	private static final int TRAIL_TICKS = 20 * 60 * 10;
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

	public static void becomeCarcass(GameAnimal animal, ServerLevel level, @Nullable UUID shooter, long shotId) {
		if (animal.isCarcass()) return;
		animal.setHuntState(GameCreature.CARCASS);
		animal.freezeAi();
		animal.carcassSince = level.getGameTime();
		animal.removeEffect(MobEffects.SLOWNESS);
		animal.setDeltaMovement(Vec3.ZERO);
		animal.getNavigation().stop();
		animal.setTarget(null);
		animal.setHealth(animal.getMaxHealth());
		animal.bleedUntil = -1;
		if (shooter != null) animal.shooter = shooter;
		if (shotId != 0) animal.shotId = shotId;
		if (animal.getDeathSound() != null) level.playSound(null, animal.blockPosition(), animal.getDeathSound(), SoundSource.NEUTRAL, 1.0F, animal.getVoicePitch());
	}

	/** Apply an evaluated shot (scripts/wounds.js applyHit). */
	public static void applyHit(GameAnimal animal, ServerLevel level, HitZones.Report r, ServerPlayer player, long shotId) {
		if (!r.hit()) {
			Senses.spook(animal, level, player.position());
			return;
		}
		animal.grade = r.grade();
		if (r.fate().equals("kill")) {
			becomeCarcass(animal, level, player.getUUID(), shotId);
			return;
		}
		double max = animal.getMaxHealth();
		double damage = 0;
		for (HitZones.ZoneHit z : r.zones()) damage += HuntingData.zone(z.zone()).damage() * (z.percent() / 100.0) * max * 0.6;
		boolean prev = animal.huntState() == GameCreature.WOUNDED;
		if (r.fate().equals("none") && !prev) {
			Senses.spook(animal, level, player.position());
			return;
		}
		if ((prev || r.fate().equals("wound")) && animal.getHealth() - damage <= 0) {
			becomeCarcass(animal, level, player.getUUID(), shotId);
			return;
		}
		if (damage > 0) animal.setHealth((float) Math.max(1, animal.getHealth() - damage));
		level.broadcastEntityEvent(animal, (byte) 2); // red flash
		String zone = r.primaryZone();
		String blood = zone == null ? "none" : HuntingData.zone(zone).blood();
		if (!blood.equals("none")) animal.blood = blood;
		else if (!prev) animal.blood = "little";
		double slows = 0;
		for (HitZones.ZoneHit z : r.zones()) slows = Math.max(slows, HuntingData.zone(z.zone()).slows());
		animal.slows = Math.max(animal.slows, slows);
		long now = level.getGameTime();
		if (r.fate().equals("mortal")) {
			animal.bleedUntil = now + Math.round(r.bleedSeconds() * 20);
			animal.recoverAt = -1;
		} else if (r.fate().equals("wound") && animal.bleedUntil < 0) {
			animal.recoverAt = now + 20 * 90;
		}
		animal.shooter = player.getUUID();
		animal.shotId = shotId;
		animal.setHuntState(GameCreature.WOUNDED);
		Senses.spook(animal, level, player.position());
	}

	/** Every tick per animal: bleeding out, dripping blood, slowing, recovering. */
	public static void tick(GameAnimal animal, ServerLevel level) {
		if (animal.huntState() != GameCreature.WOUNDED) return;
		long now = level.getGameTime();
		int every = dripEvery(animal.blood);
		if (every > 0 && now % every == 0) {
			synchronized (TRAILS) {
				TRAILS.add(new Drop(level.dimension(), new Vec3(animal.getX(), Math.floor(animal.getY()) + 0.1, animal.getZ()), now + TRAIL_TICKS,
					animal.blood.equals("dark") || animal.blood.equals("gut")));
				if (TRAILS.size() > 600) TRAILS.subList(0, TRAILS.size() - 600).clear();
			}
		}
		if (animal.slows > 0 && now % 20 == 0) animal.addEffect(new MobEffectInstance(MobEffects.SLOWNESS, 30, animal.slows > 0.5 ? 2 : 1, false, false));
		if (animal.bleedUntil >= 0 && now >= animal.bleedUntil) {
			becomeCarcass(animal, level, animal.shooter, animal.shotId);
			return;
		}
		if (animal.recoverAt >= 0 && now >= animal.recoverAt) {
			animal.recoverAt = -1;
			animal.slows = 0;
			animal.setHuntState(GameCreature.CALM);
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
	public static void fieldDress(GameAnimal carcass, ServerLevel level, Player player, ItemStack held) {
		if (!held.is(HuntingRegistry.KNIVES)) {
			player.sendOverlayMessage(Component.translatable("hunting.dress.need_knife"));
			return;
		}
		Species s = carcass.species();
		Species.Game g = s.game();
		double kg = carcass.weightKg();
		boolean baby = carcass.isBaby();
		boolean spoiled = player instanceof ServerPlayer sp && Journal.shotNotes(sp, carcass.shotId).contains("meat_damage");
		for (Species.Loot l : s.loot()) {
			int n = l.min() + level.getRandom().nextInt(l.max() - l.min() + 1);
			if (spoiled && l.item().matches(".*(meat|venison|bird|fillet).*")) n /= 2;
			if (baby) n = (int) Math.ceil(n / 3.0);
			Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(l.item()));
			if (n > 0) carcass.spawnAtLocation(level, new ItemStack(item, n));
		}
		double score = 0;
		String t = g.trophy();
		if (t != null && !baby && (carcass.isMale() || t.equals("trophy_skull") || t.equals("trophy_tusks") || !g.maleTrophy())) {
			score = Math.round(g.score() * (0.6 + 0.8 * carcass.size()) * gradeFactor(carcass.grade) * 10) / 10.0;
			ItemStack trophy = new ItemStack(HuntingRegistry.item(t));
			trophy.set(DataComponents.LORE, new ItemLore(List.of(
				Component.literal("★ " + score).withStyle(net.minecraft.ChatFormatting.GOLD),
				Component.literal(kg + " kg").withStyle(net.minecraft.ChatFormatting.GRAY))));
			carcass.spawnAtLocation(level, trophy);
			player.sendSystemMessage(Component.translatable("hunting.trophy.new", Component.translatable("entity.hunting." + s.id()), String.valueOf(score)));
			level.playSound(null, player.blockPosition(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0F, 1.2F);
		}
		if (player instanceof ServerPlayer sp) Journal.recordTrophy(sp, s.id(), kg, score, carcass.grade, carcass.shotId, level.getOverworldClockTime() / 24000);
		player.sendOverlayMessage(Component.translatable("hunting.dress.done", Component.translatable("entity.hunting." + s.id())));
		held.hurtAndBreak(1, player, EquipmentSlot.MAINHAND);
		level.playSound(null, carcass.blockPosition(), SoundEvents.SHEEP_SHEAR, SoundSource.PLAYERS, 1.0F, 1.0F);
		carcass.discard();
	}
}
