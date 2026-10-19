package dk.ulfen.hunting.item;

import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.Level;

/**
 * A scoped rifle: hold right-click to aim through the scope (the client zooms and draws the
 * reticle), left-click while aiming to fire. Firing happens on the server (hunt/Shooting).
 */
public class RifleItem extends Item {
	private final String firearm;

	public RifleItem(String firearm, Item.Properties properties) {
		super(properties);
		this.firearm = firearm;
	}

	public String firearm() {
		return this.firearm;
	}

	@Override
	public ItemUseAnimation getUseAnimation(ItemStack stack) {
		return ItemUseAnimation.SPYGLASS;
	}

	@Override
	public int getUseDuration(ItemStack stack, LivingEntity user) {
		return 72000;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (hand != InteractionHand.MAIN_HAND) return InteractionResult.PASS;
		player.startUsingItem(hand);
		if (level.isClientSide()) player.playSound(net.minecraft.sounds.SoundEvents.SPYGLASS_USE, 1.0F, 1.0F);
		return InteractionResult.CONSUME;
	}

	@Override
	public boolean releaseUsing(ItemStack stack, Level level, LivingEntity entity, int remainingTime) {
		if (level.isClientSide()) entity.playSound(net.minecraft.sounds.SoundEvents.SPYGLASS_STOP_USING, 1.0F, 1.0F);
		return false;
	}
}
