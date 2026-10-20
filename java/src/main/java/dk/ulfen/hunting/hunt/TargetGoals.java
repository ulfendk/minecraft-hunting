package dk.ulfen.hunting.hunt;

import java.util.EnumSet;

import dk.ulfen.hunting.entity.GameCreature;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.util.DefaultRandomPos;
import net.minecraft.world.phys.Vec3;

/** The hunt's goals, for our game animals and other mods' creatures alike. */
public final class TargetGoals {
	private TargetGoals() {}

	/** Spooked or wounded: run away from where the danger is. */
	public static class FleeGoal extends Goal {
		private final PathfinderMob mob;
		private final HuntTarget target;
		private final double speed;

		public FleeGoal(PathfinderMob mob, HuntTarget target, double speed) {
			this.mob = mob;
			this.target = target;
			this.speed = speed;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		private boolean fleeing() {
			int s = this.target.huntState();
			return (s == GameCreature.FLEE || s == GameCreature.WOUNDED) && this.target.hunt().fleeFrom != null;
		}

		@Override
		public boolean canUse() {
			return fleeing() && this.mob.getNavigation().isDone() && runAway();
		}

		@Override
		public boolean canContinueToUse() {
			return fleeing() && !this.mob.getNavigation().isDone();
		}

		private boolean runAway() {
			Vec3 away = DefaultRandomPos.getPosAway(this.mob, 20, 7, this.target.hunt().fleeFrom);
			if (away == null) return false;
			double k = this.target.huntState() == GameCreature.WOUNDED ? Math.max(0.5, 1 - this.target.hunt().slows * 0.6) : 1;
			return this.mob.getNavigation().moveTo(away.x, away.y, away.z, this.speed * k);
		}
	}

	/** Answering a game call: walk over to where it came from. */
	public static class LureGoal extends Goal {
		private final PathfinderMob mob;
		private final HuntTarget target;

		public LureGoal(PathfinderMob mob, HuntTarget target) {
			this.mob = mob;
			this.target = target;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		private boolean lured() {
			HuntState h = this.target.hunt();
			return h.lure != null && this.target.huntState() == GameCreature.CALM && this.mob.level().getGameTime() < h.lureUntil
				&& this.mob.position().distanceTo(h.lure) > 4;
		}

		@Override
		public boolean canUse() {
			return lured();
		}

		@Override
		public boolean canContinueToUse() {
			return lured() && !this.mob.getNavigation().isDone();
		}

		@Override
		public void start() {
			Vec3 l = this.target.hunt().lure;
			if (l != null) this.mob.getNavigation().moveTo(l.x, l.y, l.z, 1.0);
		}
	}
}
