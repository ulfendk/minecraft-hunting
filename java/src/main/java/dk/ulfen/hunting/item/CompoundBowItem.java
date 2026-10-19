package dk.ulfen.hunting.item;

import java.util.function.Predicate;

import dk.ulfen.hunting.HuntingRegistry;
import net.minecraft.world.item.BowItem;
import net.minecraft.world.item.ItemStack;

/** A bow that only shoots broadhead arrows; their hits are evaluated hit-zone by hit-zone. */
public class CompoundBowItem extends BowItem {
	public CompoundBowItem(Properties properties) {
		super(properties);
	}

	@Override
	public Predicate<ItemStack> getAllSupportedProjectiles() {
		return s -> s.is(HuntingRegistry.item("broadhead_arrow"));
	}

	@Override
	public int getDefaultProjectileRange() {
		return 30;
	}
}
