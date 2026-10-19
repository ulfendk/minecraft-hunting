package dk.ulfen.hunting.item;

import dk.ulfen.hunting.hunt.Diving;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

/** The scuba tank: its bar shows the air left (seconds of breathing under water), not wear. */
public class ScubaTankItem extends Item {
	public ScubaTankItem(Properties properties) {
		super(properties);
	}

	@Override
	public boolean isBarVisible(ItemStack stack) {
		return Diving.air(stack) < Diving.maxAir();
	}

	@Override
	public int getBarWidth(ItemStack stack) {
		return Math.round(13F * Diving.air(stack) / Diving.maxAir());
	}

	@Override
	public int getBarColor(ItemStack stack) {
		return 0x40A0FF;
	}
}
