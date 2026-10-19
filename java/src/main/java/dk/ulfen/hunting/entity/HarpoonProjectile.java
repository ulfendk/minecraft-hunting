package dk.ulfen.hunting.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.ProjectileHits;
import dk.ulfen.hunting.hunt.Tether;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.EntityHitResult;
import org.jspecify.annotations.Nullable;

/**
 * A harpoon bolt or a thrown hand harpoon. It keeps its speed under water (arrows don't);
 * fired through the air it is weak (`power`). A game animal it hits is evaluated hit zone by
 * hit zone and put on the line ({@link Tether}); the harpoon stays in it until it is landed.
 */
public abstract class HarpoonProjectile extends AbstractArrow implements GeoEntity {
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);
	/** 1 under water; less when fired or thrown through the air (scales penetration). */
	public double power = 1;
	/** Fired by a submarine's launcher: its winch reels the line in. */
	public boolean winch;

	protected HarpoonProjectile(EntityType<? extends HarpoonProjectile> type, Level level) {
		super(type, level);
	}

	protected HarpoonProjectile(EntityType<? extends HarpoonProjectile> type, Level level, LivingEntity owner, ItemStack pickup, @Nullable ItemStack weapon) {
		super(type, owner, level, pickup, weapon);
	}

	/** The submarine's launcher must not spear its own hull. */
	@Override
	protected boolean canHitEntity(net.minecraft.world.entity.Entity target) {
		net.minecraft.world.entity.Entity owner = this.getOwner();
		return super.canHitEntity(target) && (owner == null || owner.getVehicle() != target);
	}

	/** The calibre its hits are evaluated as (src/weapons.mjs CALIBRES). */
	protected abstract String calibre();

	/** How long the line is once something is on it. */
	protected abstract double lineLength();

	@Override
	protected void onHitEntity(EntityHitResult hit) {
		if (hit.getEntity() instanceof GameAnimal animal && this.level() instanceof ServerLevel level && this.getOwner() instanceof ServerPlayer player) {
			// Spearing a carcass (a dead fish floating off) just puts it on the line.
			if (!animal.isCarcass()) ProjectileHits.hit(animal, level, player, calibre(), hit.getLocation(), this.getDeltaMovement(), power, 6);
			struck(level, player, animal);
			return;
		}
		super.onHitEntity(hit);
	}

	/** The harpoon is in `target`: on the line with it, or (if it can't be held) dropped. */
	protected void struck(ServerLevel level, ServerPlayer player, Mob target) {
		ItemStack item = this.pickup == Pickup.ALLOWED ? this.getPickupItemStackOrigin().copy() : ItemStack.EMPTY;
		double length = winch ? HuntingData.SUB.line() : lineLength();
		if (!Tether.attach(player, target, item, winch, length) && !item.isEmpty()) target.spawnAtLocation(level, item);
		this.discard();
	}

	@Override
	protected SoundEvent getDefaultHitGroundSoundEvent() {
		return SoundEvents.TRIDENT_HIT_GROUND;
	}

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
		output.putDouble("Power", power);
		output.putBoolean("Winch", winch);
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
		power = input.getDoubleOr("Power", 1);
		winch = input.getBooleanOr("Winch", false);
	}

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}
}
