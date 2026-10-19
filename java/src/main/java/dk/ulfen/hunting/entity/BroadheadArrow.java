package dk.ulfen.hunting.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.HitZones;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Journal;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Shooting;
import dk.ulfen.hunting.hunt.Wounds;
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
import net.minecraft.world.phys.Vec3;
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
		if (hit.getEntity() instanceof GameAnimal animal && this.level() instanceof ServerLevel level && this.getOwner() instanceof ServerPlayer player) {
			if (animal.isCarcass()) {
				this.discard();
				return;
			}
			HuntingData.Calibre c = HuntingData.CALIBRES.get("arrow");
			Vec3 dir = this.getDeltaMovement().normalize();
			Vec3 start = hit.getLocation().subtract(dir.scale(3));
			HitZones.ModelSpace m = new HitZones.ModelSpace(animal.position(), animal.yBodyRot, animal.getScale());
			HitZones.Report r = HitZones.evaluate(Shooting.hitModelFor(animal), m.point(start), m.direction(dir), c.energy(), c.penetration(),
				6.25 * animal.getScale(), 0, true);
			// The engine says it hit; the model says it slipped past: count it as a graze.
			if (!r.hit()) r = new HitZones.Report(true, java.util.List.of(new HitZones.ZoneHit("muscle", 10)), "wound", 0, r.accuracy(), "unethical",
				null, null, null, null, false, java.util.List.of());
			double distance = player.position().distanceTo(hit.getLocation());
			long id = Journal.recordShot(player, animal, r, distance, c.name(), c.energy(), 0, 0);
			Wounds.applyHit(animal, level, r, player, id);
			Senses.makeNoise(player, 10, 20);
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
