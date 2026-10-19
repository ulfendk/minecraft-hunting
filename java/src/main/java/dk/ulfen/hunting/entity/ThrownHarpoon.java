package dk.ulfen.hunting.entity;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.HuntingData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.EntityHitResult;

/** The thrown hand harpoon. Like a trident it bounces off what it can't hold, and is picked up again. */
public class ThrownHarpoon extends HarpoonProjectile {
	private boolean dealtDamage;

	public ThrownHarpoon(EntityType<? extends ThrownHarpoon> type, Level level) {
		super(type, level);
	}

	public ThrownHarpoon(EntityType<? extends ThrownHarpoon> type, Level level, LivingEntity owner, ItemStack harpoon) {
		super(type, level, owner, harpoon, harpoon);
	}

	@Override
	protected String calibre() {
		return "thrown_harpoon";
	}

	@Override
	protected double lineLength() {
		return HuntingData.HARPOONS.get("harpoon").line();
	}

	@Override
	protected float getWaterInertia() {
		return 0.99F;
	}

	@Override
	protected void onHitEntity(EntityHitResult hit) {
		if (hit.getEntity() instanceof GameAnimal) {
			super.onHitEntity(hit);
			return;
		}
		if (dealtDamage) return;
		// Anything else (vanilla fish, squid, mobs): a stab, then it falls away, like a trident.
		Entity target = hit.getEntity();
		Entity owner = this.getOwner();
		if (this.level() instanceof ServerLevel level) {
			DamageSource source = this.damageSources().trident(this, owner == null ? this : owner);
			target.hurtServer(level, source, (float) (6 * power * power));
		}
		dealtDamage = true;
		this.setDeltaMovement(this.getDeltaMovement().multiply(-0.01, -0.1, -0.01));
	}

	@Override
	protected ItemStack getDefaultPickupItem() {
		return new ItemStack(HuntingRegistry.item("harpoon"));
	}

	@Override
	public void tickDespawn() {
		// A harpoon is a tool you want back: it stays until it is picked up.
	}
}
