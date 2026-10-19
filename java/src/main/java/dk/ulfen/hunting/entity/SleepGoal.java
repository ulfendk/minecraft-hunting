package dk.ulfen.hunting.entity;

import java.util.EnumSet;

import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.goal.Goal;

/** Lies down to sleep during the species' resting hours (day or night). */
public class SleepGoal<T extends PathfinderMob & GameCreature> extends Goal {
	private final T mob;

	public SleepGoal(T mob) {
		this.mob = mob;
		this.setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK, Goal.Flag.JUMP));
	}

	public static boolean isRestingTime(PathfinderMob mob, String sleeps) {
		return switch (sleeps) {
			case "day" -> mob.level().isBrightOutside();
			case "night" -> mob.level().isDarkOutside();
			default -> false;
		};
	}

	private boolean canSleepNow() {
		return isRestingTime(this.mob, this.mob.species().sleeps())
			&& this.mob.onGround()
			&& !this.mob.isInWater()
			&& !this.mob.isVehicle()
			&& this.mob.getTarget() == null
			&& this.mob.getLastHurtByMob() == null;
	}

	@Override
	public boolean canUse() {
		return this.mob.getRandom().nextInt(reducedTickDelay(60)) == 0 && canSleepNow();
	}

	@Override
	public boolean canContinueToUse() {
		return canSleepNow();
	}

	@Override
	public void start() {
		this.mob.getNavigation().stop();
		this.mob.setResting(true);
	}

	@Override
	public void stop() {
		this.mob.setResting(false);
	}
}
