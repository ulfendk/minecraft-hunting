package dk.ulfen.hunting.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.animation.object.PlayState;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.Diving;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Tether;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.tags.FluidTags;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageTypes;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityDimensions;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.MoverType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * A one-seat mini submarine (the Java twin of scripts/submarine.js). W/S drive it the way the
 * pilot looks (look down to dive), Space rises, the dive key sinks. It runs on a battery that
 * redstone charges; flat, it floats up. The pilot breathes and sees clearly, the lamps come on
 * in the deep or at night, and harpoon bolts fire the launcher in the nose, whose winch reels
 * a speared fish in. Breaks like a boat when players hit it.
 */
public class MiniSubmarine extends Mob implements GeoEntity {
	private static final EntityDataAccessor<Float> BATTERY = SynchedEntityData.defineId(MiniSubmarine.class, EntityDataSerializers.FLOAT);
	private static final EntityDataAccessor<Boolean> LIGHTS = SynchedEntityData.defineId(MiniSubmarine.class, EntityDataSerializers.BOOLEAN);
	private static final EntityDataAccessor<Float> THRUST = SynchedEntityData.defineId(MiniSubmarine.class, EntityDataSerializers.FLOAT);
	private static final Vec3 SEAT = new Vec3(0, 0.75, 0.35);
	private static final RawAnimation SPIN = RawAnimation.begin().thenLoop("animation.hunting.mini_submarine.spin");

	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);

	/** Pilot input. On the pilot's client it is set every tick by ClientSubmarine; the server gets it by packet. */
	public int vertical;
	private int forward;
	private int inputAge = 100;
	private boolean lightsOff;
	/** -0.5 .. 1, ramps up and down (client authoritative, like the movement). */
	private float throttle;
	private float damage;
	private int hurtTicks;
	private long firedAt = -1000;
	private boolean flatWarned;
	public int depth;

	public MiniSubmarine(EntityType<? extends MiniSubmarine> type, Level level) {
		super(type, level);
		this.setPersistenceRequired();
	}

	public static AttributeSupplier.Builder createAttributes() {
		HuntingData.Sub s = HuntingData.SUB;
		return Mob.createMobAttributes()
			.add(Attributes.MAX_HEALTH, s.health())
			.add(Attributes.MOVEMENT_SPEED, 0)
			.add(Attributes.KNOCKBACK_RESISTANCE, 1.0)
			.add(Attributes.CAMERA_DISTANCE, 6);
	}

	@Override
	protected void defineSynchedData(SynchedEntityData.Builder builder) {
		super.defineSynchedData(builder);
		builder.define(BATTERY, (float) HuntingData.SUB.battery());
		builder.define(LIGHTS, false);
		builder.define(THRUST, 0F);
	}

	public float battery() {
		return this.entityData.get(BATTERY);
	}

	public void setBattery(float b) {
		this.entityData.set(BATTERY, Mth.clamp(b, 0F, (float) HuntingData.SUB.battery()));
	}

	public float batteryFraction() {
		return battery() / (float) HuntingData.SUB.battery();
	}

	public boolean lights() {
		return this.entityData.get(LIGHTS);
	}

	public float thrust() {
		return this.entityData.get(THRUST);
	}

	public @Nullable Player pilot() {
		return this.getControllingPassenger() instanceof Player p ? p : null;
	}

	/** Control packet from the pilot (and directly from tests): vertical -1/0/1, forward -1/0/1, lights 1 = toggle. */
	public void applyInput(int vertical, int forward, int lightsToggle) {
		this.vertical = Mth.clamp(vertical, -1, 1);
		this.forward = Mth.clamp(forward, -1, 1);
		if (lightsToggle != 0) this.lightsOff = !this.lightsOff;
		this.inputAge = 0;
	}

	// ------------------------------------------------------------ moving

	private boolean waterAt(double y) {
		return this.level().getFluidState(BlockPos.containing(this.getX(), y, this.getZ())).is(FluidTags.WATER);
	}

	@Override
	public void travel(Vec3 input) {
		if (!this.isInWater()) {
			// Out of the water it is just a heavy lump.
			this.setNoGravity(false);
			super.travel(Vec3.ZERO);
			return;
		}
		this.setNoGravity(true);
		HuntingData.Sub s = HuntingData.SUB;
		boolean powered = battery() > 0;
		Player pilot = pilot();
		double t = this.level().isClientSide() ? throttle : forward;
		Vec3 target = new Vec3(0, powered ? 0 : 0.04, 0);
		if (pilot != null && powered && t != 0) target = pilot.getLookAngle().scale(t * s.speed());
		if (pilot != null && powered && vertical != 0) {
			target = new Vec3(target.x, vertical > 0 ? Math.max(target.y, s.vertical()) : Math.min(target.y, -s.vertical()), target.z);
		}
		// At the surface it can't rise any further.
		if (!waterAt(this.getY() + this.getBbHeight() + 0.1)) target = new Vec3(target.x, Math.min(target.y, 0), target.z);
		Vec3 v = this.getDeltaMovement();
		v = new Vec3(approach(v.x, target.x), approach(v.y, target.y), approach(v.z, target.z));
		this.setDeltaMovement(v);
		this.move(MoverType.SELF, v);
	}

	private static double approach(double v, double target) {
		HuntingData.Sub s = HuntingData.SUB;
		v += Mth.clamp(target - v, -s.accel(), s.accel());
		return target == 0 ? v * s.drag() : v;
	}

	@Override
	protected void tickRidden(Player controller, Vec3 riddenInput) {
		super.tickRidden(controller, riddenInput);
		if (!this.isLocalInstanceAuthoritative()) return;
		float target = battery() <= 0 ? 0 : controller.zza > 0 ? 1F : controller.zza < 0 ? -0.5F : 0F;
		throttle += Mth.clamp(target - throttle, -0.1F, 0.1F);
		// Turn towards where the pilot looks.
		float delta = Mth.wrapDegrees(controller.getYRot() - this.getYRot());
		this.setYRot(this.getYRot() + Mth.clamp(delta, (float) -HuntingData.SUB.turn(), (float) HuntingData.SUB.turn()));
		this.yRotO = this.getYRot();
		this.yBodyRot = this.yHeadRot = this.getYRot();
	}

	@Override
	protected Vec3 getRiddenInput(Player controller, Vec3 selfInput) {
		return Vec3.ZERO;
	}

	@Override
	protected float getRiddenSpeed(Player controller) {
		return 0F;
	}

	// ------------------------------------------------------------ ticking

	@Override
	public void tick() {
		super.tick();
		if (hurtTicks > 0) hurtTicks--;
		else if (damage > 0) damage = Math.max(0, damage - 1.0F);
		this.yBodyRot = this.yHeadRot = this.getYRot();
		if (this.level() instanceof ServerLevel level) serverTick(level);
	}

	private void serverTick(ServerLevel level) {
		HuntingData.Sub s = HuntingData.SUB;
		if (++inputAge > 6) {
			vertical = 0;
			forward = 0;
		}
		Player pilot = pilot();
		boolean wet = this.isInWater();
		boolean powered = battery() > 0;
		Tether.Line line = pilot instanceof ServerPlayer sp ? Tether.setWinch(sp, powered) : null;
		if (pilot != null && powered) {
			float drain = (float) (s.drain().idle() + s.drain().thrust() * Math.abs(forward) + (lights() ? s.drain().lights() : 0)
				+ (line != null && line.winch ? s.drain().thrust() * 0.5 : 0));
			setBattery(battery() - drain);
			if (battery() <= 0 && !flatWarned) {
				flatWarned = true;
				if (pilot instanceof ServerPlayer sp) sp.sendOverlayMessage(Component.translatable("hunting.sub.flat"));
				level.playSound(null, this.blockPosition(), SoundEvents.NOTE_BLOCK_BASS.value(), SoundSource.NEUTRAL, 1F, 0.5F);
			}
		}
		this.entityData.set(THRUST, pilot != null && powered ? Math.abs(forward) : 0F);
		if (this.tickCount % 10 == 0) {
			depth = 0;
			while (depth < 64 && waterAt(this.getY() + this.getBbHeight() * 0.5 + depth + 1)) depth++;
			boolean night = level.isDarkOutside();
			this.entityData.set(LIGHTS, pilot != null && powered && wet && !lightsOff && (depth >= s.lightsBelow() || night));
			if (pilot != null) {
				// A sealed cabin: the pilot always breathes; powered, they also see clearly.
				pilot.setAirSupply(pilot.getMaxAirSupply());
				if (powered && wet) {
					pilot.addEffect(new MobEffectInstance(MobEffects.CONDUIT_POWER, 40, 0, true, false, true));
					if (lights()) pilot.addEffect(new MobEffectInstance(MobEffects.NIGHT_VISION, 400, 0, true, false, true));
					if (pilot instanceof ServerPlayer sp && this.tickCount % 20 == 0) Diving.refillTank(sp);
				}
				if (forward != 0 && this.tickCount % 20 == 0) Senses.makeNoise(pilot, 8, 20);
			}
		}
	}

	// ------------------------------------------------------------ launcher and charging

	/** Using a harpoon bolt while piloting fires one from the nose, where the pilot looks. */
	public void fireLauncher(ServerLevel level, Player pilot, ItemStack bolts) {
		HuntingData.Sub.Launcher l = HuntingData.SUB.launcher();
		long now = level.getGameTime();
		if (now - firedAt < l.cooldown()) {
			pilot.sendOverlayMessage(Component.translatable("hunting.sub.reloading"));
			return;
		}
		firedAt = now;
		Vec3 forwardDir = Vec3.directionFromRotation(0, this.getYRot());
		Vec3 nose = this.position().add(forwardDir.scale(this.getBbWidth() * 0.5 + 0.9)).add(0, 0.15, 0);
		boolean wet = level.getFluidState(BlockPos.containing(nose)).is(FluidTags.WATER);
		HarpoonBolt bolt = new HarpoonBolt(HuntingRegistry.HARPOON_BOLT, level, pilot, bolts.copyWithCount(1), null);
		bolt.setPos(nose);
		Vec3 look = pilot.getLookAngle();
		bolt.shoot(look.x, look.y, look.z, (float) (l.speed() * (wet ? 1 : 0.6)), 0.5F);
		bolt.power = wet ? l.power() : l.power() * 0.45;
		bolt.winch = true;
		bolt.pickup = pilot.hasInfiniteMaterials() ? AbstractArrow.Pickup.CREATIVE_ONLY : AbstractArrow.Pickup.ALLOWED;
		level.addFreshEntity(bolt);
		if (!pilot.hasInfiniteMaterials()) bolts.shrink(1);
		level.playSound(null, nose.x, nose.y, nose.z, SoundEvents.CROSSBOW_SHOOT, SoundSource.PLAYERS, 1.0F, 0.6F);
		Senses.makeNoise(pilot, 5, 20);
	}

	/** Redstone (and blocks of it) charge the battery. */
	private boolean charge(Player player, ItemStack held) {
		Double amount = HuntingData.SUB.charge().get(BuiltInRegistries.ITEM.getKey(held.getItem()).toString());
		if (amount == null) return false;
		if (!this.level().isClientSide()) {
			if (battery() >= HuntingData.SUB.battery() - 1) {
				player.sendOverlayMessage(Component.translatable("hunting.sub.full"));
				return true;
			}
			setBattery((float) (battery() + amount));
			flatWarned = false;
			held.consume(1, player);
			player.sendOverlayMessage(Component.translatable("hunting.sub.charged", String.valueOf(Math.round(100 * batteryFraction()))));
			this.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 0.8F, 1.6F);
		}
		return true;
	}

	// ------------------------------------------------------------ riding

	@Override
	public InteractionResult interact(Player player, InteractionHand hand, Vec3 location) {
		if (charge(player, player.getItemInHand(hand))) return InteractionResult.SUCCESS;
		if (player.isSecondaryUseActive() || !this.getPassengers().isEmpty()) return InteractionResult.PASS;
		if (!this.level().isClientSide()) {
			if (player.startRiding(this) && player instanceof ServerPlayer sp && sp.addTag("hunting.sub_help")) {
				sp.sendSystemMessage(Component.translatable("hunting.sub.help_java",
					Component.keybind("key.hunting.sub_down"), Component.keybind("key.hunting.sub_lights")));
			}
		}
		return InteractionResult.SUCCESS;
	}

	@Override
	protected boolean canAddPassenger(Entity passenger) {
		return this.getPassengers().isEmpty();
	}

	@Override
	public @Nullable LivingEntity getControllingPassenger() {
		return this.getFirstPassenger() instanceof Player p ? p : null;
	}

	@Override
	protected Vec3 getPassengerAttachmentPoint(Entity passenger, EntityDimensions dimensions, float scale) {
		return SEAT.yRot(-this.getYRot() * Mth.DEG_TO_RAD);
	}

	@Override
	protected void positionRider(Entity passenger, Entity.MoveFunction moveFunction) {
		super.positionRider(passenger, moveFunction);
		if (passenger instanceof LivingEntity living) living.setYBodyRot(this.getYRot());
	}

	/** Out through the hatch on top (or beside it if that's blocked). */
	@Override
	public Vec3 getDismountLocationForPassenger(LivingEntity passenger) {
		Vec3 top = this.position().add(0, this.getBbHeight() + 0.05, 0);
		if (this.level().noCollision(passenger, passenger.getBoundingBox().move(top.subtract(passenger.position())))) return top;
		Vec3 side = new Vec3(this.getBbWidth() * 0.5 + 0.7, 0, 0).yRot(-this.getYRot() * Mth.DEG_TO_RAD);
		return this.position().add(side);
	}

	@Override
	public boolean canBeCollidedWith(@Nullable Entity other) {
		return other == null || !other.isPassengerOfSameVehicle(this);
	}

	@Override
	public boolean isPushable() {
		return false;
	}

	@Override
	public boolean isPushedByFluid() {
		return false;
	}

	// ------------------------------------------------------------ no AI, no despawn, no drops

	@Override
	protected void registerGoals() {
	}

	@Override
	public boolean removeWhenFarAway(double distSqr) {
		return false;
	}

	@Override
	public boolean requiresCustomPersistence() {
		return true;
	}

	@Override
	public boolean causeFallDamage(double fallDistance, float damageModifier, DamageSource source) {
		return false;
	}

	@Override
	protected void checkFallDamage(double ya, boolean onGround, BlockState onState, BlockPos pos) {
	}

	@Override
	public boolean canBreatheUnderwater() {
		return true;
	}

	@Override
	public boolean isAffectedByPotions() {
		return false;
	}

	@Override
	public boolean canBeLeashed() {
		return false;
	}

	@Override
	protected boolean shouldDropLoot(ServerLevel level) {
		return false;
	}

	// ------------------------------------------------------------ breaking (players only, like boats)

	@Override
	public boolean hurtServer(ServerLevel level, DamageSource source, float amount) {
		if (this.isRemoved()) return true;
		if (source.is(DamageTypes.GENERIC_KILL) || source.is(DamageTypeTags.BYPASSES_INVULNERABILITY)) {
			breakApart(level, false);
			return true;
		}
		if (!(source.getEntity() instanceof Player player)) return false;
		if (player.getAbilities().instabuild) {
			breakApart(level, false);
			return true;
		}
		this.hurtTicks = 10;
		this.damage += Math.max(1.0F, amount) * 10.0F;
		this.playSound(SoundEvents.IRON_GOLEM_HURT, 0.6F, 1.4F);
		if (this.damage > HuntingData.SUB.breakAt() * 2) breakApart(level, true);
		return true;
	}

	/** Ejects the pilot, drops the sub as an item (unless broken in creative) and removes it. */
	public void breakApart(ServerLevel level, boolean dropItem) {
		this.ejectPassengers();
		if (dropItem) {
			this.spawnAtLocation(level, new ItemStack(HuntingRegistry.item("mini_submarine")));
			this.playSound(SoundEvents.ITEM_BREAK.value(), 1.0F, 0.8F);
		}
		this.discard();
	}

	// ------------------------------------------------------------ saving

	@Override
	protected void addAdditionalSaveData(ValueOutput out) {
		super.addAdditionalSaveData(out);
		out.putFloat("Battery", battery());
		out.putBoolean("LightsOff", lightsOff);
	}

	@Override
	protected void readAdditionalSaveData(ValueInput in) {
		super.readAdditionalSaveData(in);
		setBattery(in.getFloatOr("Battery", (float) HuntingData.SUB.battery()));
		lightsOff = in.getBooleanOr("LightsOff", false);
		flatWarned = battery() <= 0;
	}

	// ------------------------------------------------------------ GeckoLib

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		controllers.add(new AnimationController<MiniSubmarine>("propeller", 2, state ->
			state.animatable().thrust() > 0.05F || state.animatable().throttle != 0 && state.animatable().pilot() != null
				? state.setAndContinue(SPIN) : PlayState.STOP));
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}
}
