package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

import dk.ulfen.hunting.entity.GameAnimal;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.species.Species;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.phys.AABB;
import org.jspecify.annotations.Nullable;

/**
 * Something that can be hunted: one of our game animals ({@link GameAnimal}) or another mod's
 * creature registered as game ({@link ForeignTargets}). Shooting, wounds, senses, the dog and
 * the journal work on this.
 */
public interface HuntTarget {
	Mob mob();

	Species species();

	HuntState hunt();

	int huntState();

	void setHuntState(int state);

	default boolean isCarcass() {
		return huntState() == GameCreature.CARCASS;
	}

	boolean isMale();

	/** 0..1, rolled once: decides weight and trophy score. */
	default float size() {
		HuntState h = hunt();
		if (h.size < 0) {
			var r = mob().getRandom();
			h.size = r.nextFloat() * r.nextFloat() < 0.15F ? 0.85F + r.nextFloat() * 0.15F : r.nextFloat() * 0.85F;
		}
		return h.size;
	}

	default double weightKg() {
		Species.Game g = species().game();
		double kg = g.weightMin() + (g.weightMax() - g.weightMin()) * size();
		return Math.round(kg * (mob().isBaby() ? 0.3 : 1) * 10) / 10.0;
	}

	/** A carcass doesn't think. */
	void freezeAi();

	/** Scale between the hit model and the world (render scale). */
	default double modelScale() {
		return mob().getScale();
	}

	/** Hit model: the male model has antlers (and other male-only parts), the female's doesn't. */
	default HitZones.Model hitModel() {
		return species().model(isMale() && !mob().isBaby());
	}

	default Component name() {
		return Component.translatable(species().nameKey());
	}

	@Nullable SoundEvent warnSound();

	@Nullable SoundEvent deathSound();

	default float voicePitch() {
		return 1.0F;
	}

	default void playAction(String name) {}

	/** The hunt's view of an entity, or null if it isn't game. */
	static @Nullable HuntTarget of(@Nullable Entity e) {
		if (e instanceof GameAnimal g) return g.species().isGame() ? g : null;
		return e instanceof Mob m ? ForeignTargets.of(m) : null;
	}

	/** Game (of any mod) inside a box. */
	static List<HuntTarget> in(ServerLevel level, AABB box, Predicate<HuntTarget> filter) {
		List<HuntTarget> out = new ArrayList<>();
		for (Mob m : level.getEntitiesOfClass(Mob.class, box, m -> m instanceof GameAnimal || ForeignTargets.isGame(m))) {
			HuntTarget t = of(m);
			if (t != null && filter.test(t)) out.add(t);
		}
		return out;
	}

	static boolean isLive(HuntTarget t) {
		return t.mob().isAlive() && !t.isCarcass();
	}
}
