package dk.ulfen.hunting.entity;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.HuntingData;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.jspecify.annotations.Nullable;

/** The speargun's (and the submarine launcher's) harpoon bolt. */
public class HarpoonBolt extends HarpoonProjectile {
	public HarpoonBolt(EntityType<? extends HarpoonBolt> type, Level level) {
		super(type, level);
		this.setBaseDamage(2.5);
	}

	public HarpoonBolt(EntityType<? extends HarpoonBolt> type, Level level, LivingEntity owner, ItemStack ammo, @Nullable ItemStack weapon) {
		super(type, level, owner, ammo, weapon);
		this.setBaseDamage(2.5);
	}

	@Override
	protected String calibre() {
		return "harpoon_bolt";
	}

	@Override
	protected double lineLength() {
		return HuntingData.HARPOONS.get("speargun").line();
	}

	@Override
	protected float getWaterInertia() {
		return 0.97F;
	}

	@Override
	protected ItemStack getDefaultPickupItem() {
		return new ItemStack(HuntingRegistry.item("harpoon_bolt"));
	}
}
