package dk.ulfen.hunting.entity;

import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.Dogs;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.AgeableMob;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.TamableAnimal;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.FollowOwnerGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.SitWhenOrderedToGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.OwnerHurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.OwnerHurtTargetGoal;
import net.minecraft.world.entity.animal.Animal;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import org.jspecify.annotations.Nullable;

/**
 * The hunting dog: tame it with venison, it follows and sits like a wolf. A dog whistle sends
 * it after the nearest wounded or downed game (hunt/Dogs), and it fetches shot birds.
 */
public class HuntingDog extends TamableAnimal implements GameCreature {
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);
	/** Set by a dog whistle: until this game time the dog is on the trail. */
	public long trackingUntil;
	/** A shot bird being carried back to the owner. */
	public Dogs.@Nullable Carried carrying;

	public HuntingDog(EntityType<? extends HuntingDog> type, Level level) {
		super(type, level);
		this.setTame(false, false);
	}

	public static AttributeSupplier.Builder createAttributes(Species s) {
		return Animal.createAnimalAttributes()
			.add(Attributes.MAX_HEALTH, s.health())
			.add(Attributes.MOVEMENT_SPEED, s.speed())
			.add(Attributes.ATTACK_DAMAGE, s.attackDamage())
			.add(Attributes.FOLLOW_RANGE, 48);
	}

	@Override
	public Species species() {
		return SpeciesRegistry.of(this.getType());
	}

	@Override
	protected void registerGoals() {
		this.goalSelector.addGoal(1, new FloatGoal(this));
		this.goalSelector.addGoal(2, new SitWhenOrderedToGoal(this));
		this.goalSelector.addGoal(3, new Dogs.TrackGoal(this));
		this.goalSelector.addGoal(4, new MeleeAttackGoal(this, 1.2, true));
		this.goalSelector.addGoal(5, new FollowOwnerGoal(this, 1.1, 10.0F, 2.0F));
		this.goalSelector.addGoal(8, new WaterAvoidingRandomStrollGoal(this, 1.0));
		this.goalSelector.addGoal(9, new LookAtPlayerGoal(this, Player.class, 8.0F));
		this.goalSelector.addGoal(10, new RandomLookAroundGoal(this));
		this.targetSelector.addGoal(1, new OwnerHurtByTargetGoal(this));
		this.targetSelector.addGoal(2, new OwnerHurtTargetGoal(this));
		this.targetSelector.addGoal(3, new HurtByTargetGoal(this).setAlertOthers());
	}

	private boolean isTameFood(ItemStack stack) {
		return stack.is(HuntingRegistry.item("raw_venison")) || stack.is(HuntingRegistry.item("raw_game_meat")) || stack.is(net.minecraft.world.item.Items.BONE);
	}

	@Override
	public boolean isFood(ItemStack stack) {
		return stack.is(HuntingRegistry.item("raw_venison")) || stack.is(HuntingRegistry.item("cooked_venison"));
	}

	@Override
	public InteractionResult mobInteract(Player player, InteractionHand hand) {
		ItemStack held = player.getItemInHand(hand);
		if (!this.isTame() && isTameFood(held)) {
			held.consume(1, player);
			if (this.level() instanceof ServerLevel) {
				if (this.random.nextInt(3) == 0) {
					this.tame(player);
					this.navigation.stop();
					this.setOrderedToSit(true);
					this.level().broadcastEntityEvent(this, (byte) 7);
				} else {
					this.level().broadcastEntityEvent(this, (byte) 6);
				}
			}
			return InteractionResult.SUCCESS;
		}
		if (this.isTame() && this.isOwnedBy(player)) {
			if (isFood(held) && this.getHealth() < this.getMaxHealth()) {
				held.consume(1, player);
				this.heal(8);
				return InteractionResult.SUCCESS;
			}
			InteractionResult r = super.mobInteract(player, hand);
			if (!r.consumesAction()) {
				this.setOrderedToSit(!this.isOrderedToSit());
				this.jumping = false;
				this.navigation.stop();
				this.setTarget(null);
				return InteractionResult.SUCCESS;
			}
			return r;
		}
		return super.mobInteract(player, hand);
	}

	@Override
	public boolean wantsToAttack(LivingEntity target, LivingEntity owner) {
		return !(target instanceof HuntingDog) && super.wantsToAttack(target, owner);
	}

	@Override
	public @Nullable AgeableMob getBreedOffspring(ServerLevel level, AgeableMob partner) {
		HuntingDog baby = (HuntingDog) this.getType().create(level, net.minecraft.world.entity.EntitySpawnReason.BREEDING);
		if (baby != null && this.getOwnerReference() != null) {
			baby.setOwnerReference(this.getOwnerReference());
			baby.setTame(true, true);
		}
		return baby;
	}

	@Override
	public void aiStep() {
		super.aiStep();
		if (this.level() instanceof ServerLevel level) Dogs.tick(this, level);
	}

	@Override
	public boolean removeWhenFarAway(double distance) {
		return !this.isTame() && super.removeWhenFarAway(distance);
	}

	// GameCreature
	@Override
	public boolean isResting() {
		return false;
	}

	@Override
	public void setResting(boolean resting) {}

	@Override
	public int getVariant() {
		return 0;
	}

	@Override
	public int eatTicks() {
		return 0;
	}

	private static @Nullable SoundEvent sound(@Nullable String id) {
		return id == null ? null : net.minecraft.core.registries.BuiltInRegistries.SOUND_EVENT.getValue(net.minecraft.resources.Identifier.parse(id));
	}

	@Override
	protected @Nullable SoundEvent getAmbientSound() {
		return this.isInSittingPose() ? null : sound(species().sounds().ambient());
	}

	@Override
	protected @Nullable SoundEvent getHurtSound(DamageSource source) {
		return sound(species().sounds().hurt());
	}

	@Override
	protected @Nullable SoundEvent getDeathSound() {
		return sound(species().sounds().death());
	}

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
	}

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		GameCreature.registerControllers(this, controllers);
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}
}
