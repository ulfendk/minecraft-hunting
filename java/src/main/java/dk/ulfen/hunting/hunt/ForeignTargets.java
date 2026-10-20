package dk.ulfen.hunting.hunt;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerEntityEvents;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.player.Player;
import org.jspecify.annotations.Nullable;

/**
 * Other mods' creatures as game. A mod ships profiles in hunting/targets/*.json (see the
 * README, "Hunting targets for other add-ons"); {@link SpeciesRegistry} loads them. Their
 * hunting state lives in a saved attachment, they're ticked from here, and when one becomes
 * a carcass it gets the entity tag {@value #CARCASS_TAG} so its own mod can show it lying dead.
 */
public final class ForeignTargets {
	/** Tells the creature's own mod that it's a carcass (lie down, stop its behaviours). */
	public static final String CARCASS_TAG = "hunting.carcass";
	/** A carcass rots away after this long (20 minutes, like the Bedrock timer). */
	private static final int ROT_TICKS = 24000;

	private static final Map<UUID, Mob> LOADED = new ConcurrentHashMap<>();
	private static final Map<Class<?>, @Nullable Method> VARIANT = new ConcurrentHashMap<>();

	private ForeignTargets() {}

	public static boolean isGame(Mob m) {
		return SpeciesRegistry.foreign(m.getType()) != null;
	}

	public static @Nullable HuntTarget of(Mob m) {
		Species s = SpeciesRegistry.foreign(m.getType());
		return s == null ? null : new Target(m, s, m.getAttachedOrCreate(HuntingRegistry.HUNT_STATE));
	}

	/** Another mod's creature, seen through the hunt. */
	record Target(Mob mob, Species species, HuntState hunt) implements HuntTarget {
		@Override
		public int huntState() {
			return this.hunt.state;
		}

		@Override
		public void setHuntState(int state) {
			if (this.hunt.state == state) return;
			this.hunt.state = state;
			if (state == GameCreature.CARCASS) this.mob.addTag(CARCASS_TAG);
			else this.mob.removeTag(CARCASS_TAG);
			this.mob.setAttached(HuntingRegistry.HUNT_STATE, this.hunt);
		}

		@Override
		public boolean isMale() {
			if ("variant0".equals(this.species.sex())) {
				Integer v = variant(this.mob);
				if (v != null) return v == 0;
			}
			if (this.hunt.male < 0) this.hunt.male = this.mob.getRandom().nextBoolean() ? 1 : 0;
			return this.hunt.male == 1;
		}

		@Override
		public void freezeAi() {
			for (Goal.Flag flag : Goal.Flag.values()) this.mob.getGoalSelector().disableControlFlag(flag);
			this.mob.getNavigation().stop();
			this.mob.setTarget(null);
			this.mob.setPersistenceRequired();
		}

		@Override
		public double modelScale() {
			return this.mob.getScale() * this.species.modelScale();
		}

		@Override
		public @Nullable SoundEvent warnSound() {
			return sound(this.species.warnSound());
		}

		@Override
		public @Nullable SoundEvent deathSound() {
			return this.species.sounds() == null ? null : sound(this.species.sounds().death());
		}

		@Override
		public float voicePitch() {
			Species.Sounds s = this.species.sounds();
			if (s == null || s.pitchMax() <= 0) return 1.0F;
			return s.pitchMin() + this.mob.getRandom().nextFloat() * (s.pitchMax() - s.pitchMin());
		}
	}

	private static @Nullable SoundEvent sound(@Nullable String id) {
		if (id == null || id.isEmpty()) return null;
		Identifier key = Identifier.tryParse(id);
		return key == null ? null : BuiltInRegistries.SOUND_EVENT.getValue(key);
	}

	/** The creature's variant, for mods whose variant 0 is the male (a public int getVariant()). */
	private static @Nullable Integer variant(Mob m) {
		Method get = VARIANT.computeIfAbsent(m.getClass(), c -> {
			try {
				Method x = c.getMethod("getVariant");
				return x.getReturnType() == int.class ? x : null;
			} catch (NoSuchMethodException e) {
				return null;
			}
		});
		try {
			return get == null ? null : (Integer) get.invoke(m);
		} catch (ReflectiveOperationException e) {
			return null;
		}
	}

	private static void loaded(Mob m) {
		HuntTarget t = of(m);
		if (t == null) return;
		LOADED.put(m.getUUID(), m);
		if (m instanceof PathfinderMob p) {
			m.getGoalSelector().addGoal(1, new TargetGoals.FleeGoal(p, t, 1.8));
			m.getGoalSelector().addGoal(3, new TargetGoals.LureGoal(p, t));
		}
		if (t.isCarcass()) t.freezeAi();
	}

	/** Every server tick: senses, wounds, and carcasses lying still and rotting. */
	private static void tick(MinecraftServer server) {
		for (Mob m : LOADED.values()) {
			if (m.isRemoved() || !(m.level() instanceof ServerLevel level)) {
				LOADED.remove(m.getUUID());
				continue;
			}
			HuntTarget t = of(m);
			if (t == null) continue;
			if (t.isCarcass()) {
				m.getNavigation().stop();
				m.setTarget(null);
				if (!Tether.isTethered(m)) m.setDeltaMovement(m.getDeltaMovement().multiply(0, 1, 0));
				if (level.getGameTime() - t.hunt().carcassSince > ROT_TICKS) m.discard();
				continue;
			}
			if (m.tickCount % 10 == 0) Senses.step(t, level);
			Wounds.tick(t, level);
			if (t.huntState() == GameCreature.ALERT) m.getNavigation().stop();
		}
	}

	public static void register() {
		ServerEntityEvents.ENTITY_LOAD.register((entity, level) -> {
			if (entity instanceof Mob m && isGame(m)) loaded(m);
		});
		ServerEntityEvents.ENTITY_UNLOAD.register((entity, level) -> LOADED.remove(entity.getUUID()));
		net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents.END_SERVER_TICK.register(ForeignTargets::tick);
		// A carcass can't be hurt or killed; a live animal hurt by a player bolts.
		ServerLivingEntityEvents.ALLOW_DAMAGE.register((entity, source, amount) -> {
			if (!(entity instanceof Mob m) || !isGame(m)) return true;
			HuntTarget t = of(m);
			return t == null || !t.isCarcass();
		});
		ServerLivingEntityEvents.AFTER_DAMAGE.register((entity, source, base, taken, blocked) -> {
			if (entity instanceof Mob m && isGame(m) && source.getEntity() instanceof Player p && m.level() instanceof ServerLevel level) {
				HuntTarget t = of(m);
				if (t != null && !t.isCarcass()) Senses.spook(t, level, p.position());
			}
		});
		ServerLivingEntityEvents.ALLOW_DEATH.register((entity, source, amount) -> {
			if (!(entity instanceof Mob m) || !isGame(m)) return true;
			HuntTarget t = of(m);
			return t == null || !t.isCarcass();
		});
		// Field dressing with a knife.
		UseEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
			if (world.isClientSide() || !(entity instanceof Mob m) || !isGame(m) || !(world instanceof ServerLevel level)) return InteractionResult.PASS;
			HuntTarget t = of(m);
			if (t == null || !t.isCarcass()) return InteractionResult.PASS;
			Wounds.fieldDress(t, level, player, player.getItemInHand(hand));
			return InteractionResult.SUCCESS;
		});
	}
}
