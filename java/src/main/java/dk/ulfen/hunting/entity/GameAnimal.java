package dk.ulfen.hunting.entity;

import java.util.EnumSet;
import java.util.UUID;

import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Wounds;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.util.RandomSource;
import net.minecraft.world.DifficultyInstance;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.AgeableMob;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.SpawnGroupData;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.control.FlyingMoveControl;
import net.minecraft.world.entity.ai.goal.BreedGoal;
import net.minecraft.world.entity.ai.goal.EatBlockGoal;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.FollowParentGoal;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.PanicGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.TemptGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomFlyingGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.navigation.FlyingPathNavigation;
import net.minecraft.world.entity.ai.navigation.PathNavigation;
import net.minecraft.world.entity.ai.util.DefaultRandomPos;
import net.minecraft.world.entity.animal.Animal;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * Every game animal. Behaviour comes from its {@link Species}; hunting state (alert, fleeing,
 * wounded, carcass) is driven by {@link Senses} and {@link Wounds}, like the Bedrock scripts.
 */
public class GameAnimal extends Animal implements GameCreature {
	private static final EntityDataAccessor<Boolean> RESTING = SynchedEntityData.defineId(GameAnimal.class, EntityDataSerializers.BOOLEAN);
	private static final EntityDataAccessor<Integer> VARIANT = SynchedEntityData.defineId(GameAnimal.class, EntityDataSerializers.INT);
	private static final EntityDataAccessor<Integer> STATE = SynchedEntityData.defineId(GameAnimal.class, EntityDataSerializers.INT);
	/** A carcass rots away after this long (20 minutes, like the Bedrock timer). */
	private static final int ROT_TICKS = 24000;

	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);
	private int eatTicks;

	// Senses
	public double awareness;
	public long fleeUntil;
	public @Nullable Vec3 fleeFrom;
	public @Nullable Vec3 lure;
	public long lureUntil;
	// Wounds
	public long bleedUntil = -1;
	public long recoverAt = -1;
	public String blood = "none";
	public double slows;
	public @Nullable UUID shooter;
	public long shotId;
	public String grade = "good";
	public long carcassSince;
	private float size = -1;

	public void setSize(float size) {
		this.size = size;
	}

	public GameAnimal(EntityType<? extends GameAnimal> type, Level level) {
		super(type, level);
		if (species().flies()) this.moveControl = new FlyingMoveControl(this, 20, true);
		this.refreshDimensions();
	}

	public static AttributeSupplier.Builder createAttributes(Species s) {
		AttributeSupplier.Builder b = Animal.createAnimalAttributes()
			.add(Attributes.MAX_HEALTH, s.health())
			.add(Attributes.MOVEMENT_SPEED, s.speed())
			.add(Attributes.FOLLOW_RANGE, Math.max(32, s.huntRange() + 8))
			.add(Attributes.KNOCKBACK_RESISTANCE, s.knockbackResistance())
			.add(Attributes.SCALE, s.scale());
		if (s.attacks()) b.add(Attributes.ATTACK_DAMAGE, s.attackDamage());
		if (s.flies()) b.add(Attributes.FLYING_SPEED, s.flySpeed() * 2.5);
		return b;
	}

	@Override
	public Species species() {
		return SpeciesRegistry.of(this.getType());
	}

	@Override
	protected void defineSynchedData(SynchedEntityData.Builder builder) {
		super.defineSynchedData(builder);
		builder.define(RESTING, false);
		builder.define(VARIANT, 0);
		builder.define(STATE, CALM);
	}

	@Override
	protected PathNavigation createNavigation(Level level) {
		if (SpeciesRegistry.of(this.getType()).flies()) {
			FlyingPathNavigation nav = new FlyingPathNavigation(this, level);
			nav.setCanOpenDoors(false);
			nav.setCanFloat(true);
			return nav;
		}
		return super.createNavigation(level);
	}

	@Override
	protected void registerGoals() {
		Species s = species();
		this.goalSelector.addGoal(0, new FloatGoal(this));
		this.goalSelector.addGoal(1, new FleeGoal(this, s.fleeSpeed()));
		if (!s.attacks()) this.goalSelector.addGoal(2, new PanicGoal(this, s.panicSpeed()));
		this.goalSelector.addGoal(2, new BreedGoal(this, 1.0));
		this.goalSelector.addGoal(3, new LureGoal(this));
		this.goalSelector.addGoal(4, new TemptGoal(this, 1.1, this::isTemptItem, false));
		this.goalSelector.addGoal(5, new FollowParentGoal(this, 1.1));
		this.goalSelector.addGoal(6, new SleepGoal<>(this));
		if (s.grazes()) this.goalSelector.addGoal(7, new EatBlockGoal(this));
		if (s.flies()) this.goalSelector.addGoal(8, new WaterAvoidingRandomFlyingGoal(this, 1.0));
		else this.goalSelector.addGoal(8, new WaterAvoidingRandomStrollGoal(this, 0.8));
		this.goalSelector.addGoal(9, new LookAtPlayerGoal(this, Player.class, 8.0F));
		this.goalSelector.addGoal(10, new RandomLookAroundGoal(this));
		HuntGoals.addCombat(this, s, this.goalSelector, this.targetSelector);
	}

	private boolean isTemptItem(ItemStack stack) {
		return matches(stack, species().tempt());
	}

	static boolean matches(ItemStack stack, Iterable<String> ids) {
		String id = BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
		for (String s : ids) if (s.equals(id)) return true;
		return false;
	}

	@Override
	public boolean isFood(ItemStack stack) {
		return matches(stack, species().breed());
	}

	@Override
	public @Nullable AgeableMob getBreedOffspring(ServerLevel level, AgeableMob partner) {
		GameAnimal baby = (GameAnimal) this.getType().create(level, EntitySpawnReason.BREEDING);
		if (baby != null) baby.setVariant(this.random.nextBoolean() ? this.getVariant() : ((GameCreature) partner).getVariant());
		return baby;
	}

	@Override
	public @Nullable SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty, EntitySpawnReason reason, @Nullable SpawnGroupData groupData) {
		int variants = species().variants();
		if (variants > 1) setVariant(this.random.nextInt(variants + 1) == 0 ? 0 : 1 + this.random.nextInt(variants - 1));
		return super.finalizeSpawn(level, difficulty, reason, groupData);
	}

	// ---------------------------------------------------------------- state

	@Override
	public boolean isResting() {
		return this.entityData.get(RESTING);
	}

	@Override
	public void setResting(boolean resting) {
		this.entityData.set(RESTING, resting);
	}

	@Override
	public int getVariant() {
		return this.entityData.get(VARIANT);
	}

	public void setVariant(int variant) {
		this.entityData.set(VARIANT, variant);
	}

	@Override
	public int huntState() {
		return this.entityData.get(STATE);
	}

	public void setHuntState(int state) {
		if (state != huntState()) this.entityData.set(STATE, state);
		if (state >= FLEE) setResting(false);
	}

	public boolean isCarcass() {
		return huntState() == CARCASS;
	}

	public boolean isMale() {
		return getVariant() == 0;
	}

	/** 0..1, rolled once: decides weight and trophy score. */
	public float size() {
		if (this.size < 0) this.size = this.random.nextFloat() * this.random.nextFloat() < 0.15F ? 0.85F + this.random.nextFloat() * 0.15F : this.random.nextFloat() * 0.85F;
		return this.size;
	}

	public double weightKg() {
		Species.Game g = species().game();
		double kg = g.weightMin() + (g.weightMax() - g.weightMin()) * size();
		return Math.round(kg * (this.isBaby() ? 0.3 : 1) * 10) / 10.0;
	}

	@Override
	public int eatTicks() {
		return this.eatTicks;
	}

	@Override
	public void handleEntityEvent(byte id) {
		if (id == 10) this.eatTicks = 40;
		else super.handleEntityEvent(id);
	}

	@Override
	public void aiStep() {
		super.aiStep();
		if (this.eatTicks > 0) this.eatTicks--;
		if (this.isResting() || isCarcass()) this.getNavigation().stop();
		if (this.level() instanceof ServerLevel level) {
			if (isCarcass()) {
				this.setDeltaMovement(this.getDeltaMovement().multiply(0, 1, 0));
				if (level.getGameTime() - this.carcassSince > ROT_TICKS) this.discard();
				return;
			}
			if (this.tickCount % 10 == 0) Senses.step(this, level);
			Wounds.tick(this, level);
			if (huntState() == ALERT) this.getNavigation().stop();
		}
	}

	/** A carcass doesn't think: every goal is switched off. */
	public void freezeAi() {
		for (Goal.Flag flag : Goal.Flag.values()) {
			this.goalSelector.disableControlFlag(flag);
			this.targetSelector.disableControlFlag(flag);
		}
	}

	@Override
	public boolean hurtServer(ServerLevel level, DamageSource source, float damage) {
		if (isCarcass()) return false;
		setResting(false);
		boolean hurt = super.hurtServer(level, source, damage);
		if (hurt && source.getEntity() instanceof Player p) Senses.spook(this, level, p.position());
		return hurt;
	}

	@Override
	public boolean isPushable() {
		return !isCarcass() && super.isPushable();
	}

	@Override
	public boolean removeWhenFarAway(double distance) {
		return huntState() == CALM && super.removeWhenFarAway(distance);
	}

	/** Field dressing a carcass with a hunting knife. */
	@Override
	public InteractionResult mobInteract(Player player, InteractionHand hand) {
		if (isCarcass()) {
			if (this.level() instanceof ServerLevel level) Wounds.fieldDress(this, level, player, player.getItemInHand(hand));
			return InteractionResult.SUCCESS;
		}
		return super.mobInteract(player, hand);
	}

	@Override
	public boolean causeFallDamage(double fallDistance, float damageModifier, DamageSource source) {
		return !species().fallImmune() && super.causeFallDamage(fallDistance, damageModifier, source);
	}

	// ---------------------------------------------------------------- sounds

	private static @Nullable SoundEvent sound(@Nullable String id) {
		return id == null ? null : BuiltInRegistries.SOUND_EVENT.getValue(Identifier.parse(id));
	}

	public @Nullable SoundEvent warnSound() {
		return sound(species().warnSound());
	}

	@Override
	protected @Nullable SoundEvent getAmbientSound() {
		return isResting() || isCarcass() ? null : sound(species().sounds().ambient());
	}

	@Override
	protected @Nullable SoundEvent getHurtSound(DamageSource source) {
		return sound(species().sounds().hurt());
	}

	@Override
	public @Nullable SoundEvent getDeathSound() {
		return sound(species().sounds().death());
	}

	@Override
	public int getAmbientSoundInterval() {
		return species().sounds().interval() * 20;
	}

	@Override
	public float getVoicePitch() {
		Species.Sounds s = species().sounds();
		float pitch = s.pitchMin() + this.random.nextFloat() * (s.pitchMax() - s.pitchMin());
		return this.isBaby() ? pitch * 1.4F : pitch;
	}

	// ---------------------------------------------------------------- saving

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
		output.putInt("Variant", getVariant());
		output.putInt("HuntState", huntState());
		output.putFloat("Size", size());
		output.putLong("BleedUntil", this.bleedUntil);
		output.putLong("RecoverAt", this.recoverAt);
		output.putString("Blood", this.blood);
		output.putDouble("Slows", this.slows);
		output.putLong("ShotId", this.shotId);
		output.putString("Grade", this.grade);
		output.putLong("CarcassSince", this.carcassSince);
		if (this.shooter != null) output.putString("Shooter", this.shooter.toString());
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
		setVariant(input.getIntOr("Variant", 0));
		this.entityData.set(STATE, input.getIntOr("HuntState", CALM));
		if (isCarcass()) freezeAi();
		this.size = input.getFloatOr("Size", -1);
		this.bleedUntil = input.getLongOr("BleedUntil", -1);
		this.recoverAt = input.getLongOr("RecoverAt", -1);
		this.blood = input.getStringOr("Blood", "none");
		this.slows = input.getDoubleOr("Slows", 0);
		this.shotId = input.getLongOr("ShotId", 0);
		this.grade = input.getStringOr("Grade", "good");
		this.carcassSince = input.getLongOr("CarcassSince", 0);
		String s = input.getStringOr("Shooter", "");
		this.shooter = s.isEmpty() ? null : UUID.fromString(s);
	}

	// ---------------------------------------------------------------- GeckoLib

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		GameCreature.registerControllers(this, controllers);
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}

	/** Spawn rule: on solid ground with some daylight. */
	public static boolean checkSpawn(EntityType<? extends Mob> type, ServerLevelAccessor level, EntitySpawnReason reason, BlockPos pos, RandomSource random) {
		BlockPos below = pos.below();
		boolean solid = level.getBlockState(below).isFaceSturdy(level, below, net.minecraft.core.Direction.UP);
		return (solid || level.getFluidState(below).isSource()) && level.getRawBrightness(pos, 0) > 8;
	}

	// ---------------------------------------------------------------- goals

	/** Spooked or wounded: run away from where the danger is. */
	static class FleeGoal extends Goal {
		private final GameAnimal mob;
		private final double speed;

		FleeGoal(GameAnimal mob, double speed) {
			this.mob = mob;
			this.speed = speed;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		private boolean fleeing() {
			int s = this.mob.huntState();
			return (s == FLEE || s == WOUNDED) && this.mob.fleeFrom != null;
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
			Vec3 away = DefaultRandomPos.getPosAway(this.mob, 20, 7, this.mob.fleeFrom);
			if (away == null) return false;
			double k = this.mob.huntState() == WOUNDED ? Math.max(0.5, 1 - this.mob.slows * 0.6) : 1;
			return this.mob.getNavigation().moveTo(away.x, away.y, away.z, this.speed * k);
		}
	}

	/** Answering a game call: walk over to where it came from. */
	static class LureGoal extends Goal {
		private final GameAnimal mob;

		LureGoal(GameAnimal mob) {
			this.mob = mob;
			this.setFlags(EnumSet.of(Goal.Flag.MOVE));
		}

		private boolean lured() {
			return this.mob.lure != null && this.mob.huntState() == CALM && this.mob.level().getGameTime() < this.mob.lureUntil
				&& this.mob.position().distanceTo(this.mob.lure) > 4;
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
			Vec3 l = this.mob.lure;
			if (l != null) this.mob.getNavigation().moveTo(l.x, l.y, l.z, 1.0);
		}
	}

	/** For other code: is this entity a live game animal? */
	public static boolean isLiveGame(Entity e) {
		return e instanceof GameAnimal g && g.isAlive() && !g.isCarcass();
	}
}
