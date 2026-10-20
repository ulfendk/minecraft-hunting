package dk.ulfen.hunting.hunt;

import java.util.EnumSet;
import java.util.List;

import dk.ulfen.hunting.entity.GameAnimal;
import net.minecraft.world.entity.Mob;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.entity.HuntingDog;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.goal.Goal;
import org.jspecify.annotations.Nullable;

/**
 * The hunting dog's work (the Java twin of scripts/dog.js): a whistle sends tame dogs after
 * the nearest wounded or downed game; they bark when they find it and fetch birds.
 */
public final class Dogs {
	private static final int TRACK_TICKS = 20 * 60;

	private Dogs() {}

	/** A shot bird carried in the dog's mouth. */
	public record Carried(EntityType<?> type, int variant, float size, String grade, long shotId, java.util.@Nullable UUID shooter) {}

	private static @Nullable Mob quarry(HuntingDog dog, ServerLevel level, @Nullable LivingEntity owner) {
		Mob best = null;
		double bestD = Double.MAX_VALUE;
		for (HuntTarget g : HuntTarget.in(level, dog.getBoundingBox().inflate(160), a -> a.huntState() >= GameCreature.WOUNDED)) {
			var shooter = g.hunt().shooter;
			if (g.isCarcass() && shooter != null && owner != null && !shooter.equals(owner.getUUID())) continue;
			double d = g.mob().distanceToSqr(dog);
			if (d < bestD) {
				best = g.mob();
				bestD = d;
			}
		}
		return best;
	}

	public static void whistle(ServerPlayer player) {
		ServerLevel level = player.level();
		level.playSound(null, player.blockPosition(), SoundEvents.NOTE_BLOCK_FLUTE.value(), SoundSource.PLAYERS, 3.0F, 2.0F);
		List<HuntingDog> dogs = level.getEntitiesOfClass(HuntingDog.class, player.getBoundingBox().inflate(40), d -> d.isTame() && d.isOwnedBy(player));
		if (dogs.isEmpty()) {
			player.sendOverlayMessage(Component.translatable("hunting.dog.no_dog"));
			return;
		}
		if (quarry(dogs.getFirst(), level, player) == null) {
			player.sendOverlayMessage(Component.translatable("hunting.dog.no_trail"));
			for (HuntingDog d : dogs) d.playSound(Sounds.get("entity.wolf.whine"), 1.0F, 1.0F);
			return;
		}
		for (HuntingDog d : dogs) {
			d.setOrderedToSit(false);
			d.trackingUntil = level.getGameTime() + TRACK_TICKS;
			d.playSound(Sounds.get("entity.wolf.ambient"), 1.0F, 1.1F);
		}
		player.sendOverlayMessage(Component.translatable("hunting.dog.tracking"));
	}

	/** Every tick per dog: found it? carrying a bird home? */
	public static void tick(HuntingDog dog, ServerLevel level) {
		LivingEntity owner = dog.getOwner();
		if (dog.carrying != null) {
			if (owner != null && dog.distanceToSqr(owner) < 3.5 * 3.5) {
				place(level, dog.carrying, owner);
				dog.carrying = null;
				dog.playSound(Sounds.get("entity.wolf.pant"), 1.0F, 1.0F);
			}
			return;
		}
		if (dog.trackingUntil <= level.getGameTime()) return;
		if (dog.tickCount % 40 == 0) dog.playSound(SoundEvents.FOX_SNIFF, 1.0F, 0.8F);
		List<HuntTarget> found = HuntTarget.in(level, dog.getBoundingBox().inflate(3), a -> a.huntState() >= GameCreature.WOUNDED);
		if (found.isEmpty()) return;
		HuntTarget g = found.getFirst();
		dog.trackingUntil = 0;
		dog.playSound(Sounds.get("entity.wolf.ambient"), 3.0F, 1.0F);
		if (owner instanceof ServerPlayer p) p.sendOverlayMessage(Component.translatable("hunting.dog.found", g.name()));
		// Our birds are fetched (other mods' creatures are left where they lie).
		if (g.species().bird() && g.isCarcass() && g instanceof GameAnimal bird) {
			dog.carrying = new Carried(bird.getType(), bird.getVariant(), bird.size(), bird.hunt().grade, bird.hunt().shotId, bird.hunt().shooter);
			bird.discard();
		}
	}

	/** Lay the fetched bird down at the owner's feet. */
	private static void place(ServerLevel level, Carried c, LivingEntity at) {
		if (!(c.type().create(level, EntitySpawnReason.EVENT) instanceof GameAnimal g)) return;
		g.snapTo(at.getX(), at.getY(), at.getZ(), at.getYRot(), 0);
		g.setVariant(c.variant());
		g.setSize(c.size());
		g.hunt().grade = c.grade();
		level.addFreshEntity(g);
		Wounds.becomeCarcass(g, level, c.shooter(), c.shotId());
	}

	/** Follow the trail: run to the nearest wounded or downed game. */
	public static class TrackGoal extends Goal {
		private final HuntingDog dog;
		private @Nullable Mob target;

		public TrackGoal(HuntingDog dog) {
			this.dog = dog;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK));
		}

		private boolean tracking() {
			return this.dog.trackingUntil > this.dog.level().getGameTime() && this.dog.carrying == null;
		}

		@Override
		public boolean canUse() {
			if (!tracking() || !(this.dog.level() instanceof ServerLevel level)) return false;
			this.target = quarry(this.dog, level, this.dog.getOwner());
			return this.target != null;
		}

		@Override
		public boolean canContinueToUse() {
			return tracking() && this.target != null && this.target.isAlive() && this.dog.distanceToSqr(this.target) > 2.5 * 2.5;
		}

		@Override
		public void tick() {
			if (this.target == null) return;
			this.dog.getLookControl().setLookAt(this.target, 30, 30);
			if (this.dog.tickCount % 10 == 0) this.dog.getNavigation().moveTo(this.target, 1.4);
		}

		@Override
		public void stop() {
			this.target = null;
			this.dog.getNavigation().stop();
		}
	}
}
