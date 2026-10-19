package dk.ulfen.hunting.item;

import dk.ulfen.hunting.hunt.HuntingData;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.Item;

/** A stainless dive knife: it cuts harder under water, and field dresses like the hunting knife. */
public class DiveKnifeItem extends Item {
	public DiveKnifeItem(Properties properties) {
		super(properties);
	}

	@Override
	public float getAttackDamageBonus(Entity target, float damage, DamageSource source) {
		return source.getEntity() != null && source.getEntity().isEyeInFluid(FluidTags.WATER) ? HuntingData.DIVE.knifeBonus() : 0;
	}
}
