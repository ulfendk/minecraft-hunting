package dk.ulfen.hunting.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.ProjectileHits;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.EntityHitResult;
import org.jspecify.annotations.Nullable;

/** The compound bow's arrow. Hitting a game animal is evaluated hit zone by hit zone. */
public class BroadheadArrow extends AbstractArrow implements GeoEntity {
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);

	public BroadheadArrow(EntityType<? extends BroadheadArrow> type, Level level) {
		super(type, level);
		this.setBaseDamage(3.0);
	}

	public BroadheadArrow(EntityType<? extends BroadheadArrow> type, Level level, LivingEntity owner, ItemStack ammo, @Nullable ItemStack weapon) {
		super(type, owner, level, ammo, weapon);
		this.setBaseDamage(3.0);
	}

	@Override
	protected void onHitEntity(EntityHitResult hit) {
		if (dk.ulfen.hunting.hunt.HuntTarget.of(hit.getEntity()) instanceof dk.ulfen.hunting.hunt.HuntTarget animal && this.level() instanceof ServerLevel level && this.getOwner() instanceof ServerPlayer player) {
			if (animal.isCarcass()) {
				this.discard();
				return;
			}
			ProjectileHits.hit(animal, level, player, "arrow", hit.getLocation(), this.getDeltaMovement(), 1.0, 10);
			this.playSound(SoundEvents.ARROW_HIT, 1.0F, 1.2F);
			this.discard();
			return;
		}
		super.onHitEntity(hit);
	}

	@Override
	protected ItemStack getDefaultPickupItem() {
		return new ItemStack(HuntingRegistry.item("broadhead_arrow"));
	}

	@Override
	protected SoundEvent getDefaultHitGroundSoundEvent() {
		return SoundEvents.ARROW_HIT;
	}

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}
}
