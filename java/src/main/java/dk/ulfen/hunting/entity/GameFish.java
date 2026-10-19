package dk.ulfen.hunting.entity;

import java.util.EnumSet;
import java.util.List;

import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.FluidTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.control.SmoothSwimmingLookControl;
import net.minecraft.world.entity.ai.control.SmoothSwimmingMoveControl;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.goal.PanicGoal;
import net.minecraft.world.entity.ai.goal.RandomSwimmingGoal;
import net.minecraft.world.entity.ai.navigation.PathNavigation;
import net.minecraft.world.entity.ai.navigation.WaterBoundPathNavigation;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.pathfinder.PathType;
import net.minecraft.world.phys.Vec3;

/**
 * Game fish (sea bass, tuna, porbeagle shark): swim like dolphins, school, flee from divers
 * through the water, suffocate on land. A dead fish floats up to the surface.
 */
public class GameFish extends GameAnimal {
	public GameFish(EntityType<? extends GameFish> type, Level level) {
		super(type, level);
		this.moveControl = new SmoothSwimmingMoveControl<>(this, 85, 10, 0.02F, 0.1F, true);
		this.lookControl = new SmoothSwimmingLookControl(this, 10);
		this.setPathfindingMalus(PathType.WATER, 0.0F);
	}

	/** Swimming speed drives the smooth-swimming control (like a dolphin's). */
	public static AttributeSupplier.Builder createAttributes(Species s) {
		return GameAnimal.createAttributes(s).add(Attributes.MOVEMENT_SPEED, s.swimSpeed() * 8);
	}

	@Override
	protected PathNavigation createNavigation(Level level) {
		return new WaterBoundPathNavigation(this, level);
	}

	@Override
	protected void registerGoals() {
		Species s = species();
		this.goalSelector.addGoal(1, new SwimFleeGoal(this, s.fleeSpeed()));
		if (!s.attacks()) this.goalSelector.addGoal(2, new PanicGoal(this, s.panicSpeed()));
		if (s.school()) this.goalSelector.addGoal(5, new SchoolGoal(this));
		this.goalSelector.addGoal(6, new RandomSwimmingGoal(this, 1.0, 40) {
			@Override
			public boolean canUse() {
				return !GameFish.this.isCarcass() && GameFish.this.isInWater() && super.canUse();
			}
		});
		HuntGoals.addCombat(this, s, this.goalSelector, this.targetSelector);
	}

	@Override
	public boolean canBreatheUnderwater() {
		return true;
	}

	@Override
	public boolean isPushedByFluid() {
		return false;
	}

	@Override
	protected void travelInWater(Vec3 input, double gravity, boolean falling, double oldY) {
		if (isCarcass()) {
			// Dead fish float up.
			this.addDeltaMovement(new Vec3(0, 0.012, 0));
			super.travelInWater(input, gravity, falling, oldY);
			return;
		}
		this.moveRelative(this.getSpeed(), input);
		this.move(net.minecraft.world.entity.MoverType.SELF, this.getDeltaMovement());
		this.setDeltaMovement(this.getDeltaMovement().scale(0.9));
	}

	@Override
	public void baseTick() {
		int air = this.getAirSupply();
		super.baseTick();
		// A fish out of water suffocates.
		if (this.level() instanceof ServerLevel level && this.isAlive() && !isCarcass() && !this.isInWater()) {
			this.setAirSupply(air - 1);
			if (this.getAirSupply() <= -20) {
				this.setAirSupply(0);
				this.hurtServer(level, this.damageSources().drown(), 2.0F);
			}
		} else if (this.isInWater()) {
			this.setAirSupply(this.getMaxAirSupply());
		}
	}

	@Override
	public void aiStep() {
		// Flapping about on dry land.
		if (!this.isInWater() && this.onGround() && this.verticalCollision && !isCarcass()) {
			this.setDeltaMovement(this.getDeltaMovement().add((this.random.nextFloat() * 2 - 1) * 0.05F, 0.4F, (this.random.nextFloat() * 2 - 1) * 0.05F));
			this.setOnGround(false);
			this.playSound(SoundEvents.COD_FLOP, 0.6F, this.getVoicePitch());
		}
		super.aiStep();
	}

	/** Spawn rule: in water, inside the species' depth band. */
	public static boolean checkSpawn(EntityType<? extends Mob> type, ServerLevelAccessor level, EntitySpawnReason reason, BlockPos pos, RandomSource random) {
		if (!level.getFluidState(pos).is(FluidTags.WATER) || !level.getFluidState(pos.above()).is(FluidTags.WATER)) return false;
		if (reason != EntitySpawnReason.NATURAL && reason != EntitySpawnReason.CHUNK_GENERATION) return true;
		Species s = SpeciesRegistry.of(type);
		return s.spawns().stream().anyMatch(sp -> pos.getY() >= sp.minY() && pos.getY() <= sp.maxY());
	}

	// ---------------------------------------------------------------- goals

	/** Spooked or wounded: dart away from the danger, through the water. */
	static class SwimFleeGoal extends Goal {
		private final GameFish fish;
		private final double speed;

		SwimFleeGoal(GameFish fish, double speed) {
			this.fish = fish;
			this.speed = speed;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		private boolean fleeing() {
			int s = this.fish.huntState();
			return (s == FLEE || s == WOUNDED) && this.fish.fleeFrom != null && this.fish.isInWater();
		}

		@Override
		public boolean canUse() {
			return fleeing() && this.fish.getNavigation().isDone() && swimAway();
		}

		@Override
		public boolean canContinueToUse() {
			return fleeing() && !this.fish.getNavigation().isDone();
		}

		private boolean swimAway() {
			Vec3 away = this.fish.position().subtract(this.fish.fleeFrom);
			away = away.lengthSqr() < 1e-4 ? new Vec3(1, 0, 0) : away.normalize();
			RandomSource r = this.fish.getRandom();
			for (int i = 0; i < 8; i++) {
				Vec3 to = this.fish.position().add(away.scale(10 + r.nextInt(8))).add(r.nextInt(9) - 4, r.nextInt(5) - 2, r.nextInt(9) - 4);
				BlockPos p = BlockPos.containing(to);
				if (!this.fish.level().getFluidState(p).is(FluidTags.WATER)) continue;
				double k = this.fish.huntState() == WOUNDED ? Math.max(0.5, 1 - this.fish.slows * 0.6) : 1;
				if (this.fish.getNavigation().moveTo(to.x, to.y, to.z, this.speed * k)) return true;
			}
			return false;
		}
	}

	/** Schooling: keep close to the nearest fish of the same kind. */
	static class SchoolGoal extends Goal {
		private final GameFish fish;
		private GameFish leader;
		private int next;

		SchoolGoal(GameFish fish) {
			this.fish = fish;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		@Override
		public boolean canUse() {
			if (this.fish.huntState() != CALM || --this.next > 0) return false;
			this.next = 40 + this.fish.getRandom().nextInt(40);
			List<GameFish> near = this.fish.level().getEntitiesOfClass(GameFish.class, this.fish.getBoundingBox().inflate(10),
				f -> f != this.fish && f.getType() == this.fish.getType() && !f.isCarcass());
			this.leader = near.stream().min((a, b) -> Double.compare(a.distanceToSqr(this.fish), b.distanceToSqr(this.fish))).orElse(null);
			return this.leader != null && this.leader.distanceToSqr(this.fish) > 9;
		}

		@Override
		public boolean canContinueToUse() {
			return this.leader != null && this.leader.isAlive() && this.fish.huntState() == CALM && this.leader.distanceToSqr(this.fish) > 4
				&& !this.fish.getNavigation().isDone();
		}

		@Override
		public void start() {
			this.fish.getNavigation().moveTo(this.leader, 1.0);
		}
	}
}
