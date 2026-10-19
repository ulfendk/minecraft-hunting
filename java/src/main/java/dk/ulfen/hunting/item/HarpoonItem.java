package dk.ulfen.hunting.item;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.ThrownHarpoon;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Tether;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.Level;

/**
 * The hand harpoon: hold use and let go to throw it (scripts/harpoon.js on Bedrock). Made for
 * water: thrown through the air it is slower and weaker. With a fish on the line, using it
 * lets go of the line instead.
 */
public class HarpoonItem extends Item {
	public HarpoonItem(Properties properties) {
		super(properties);
	}

	@Override
	public ItemUseAnimation getUseAnimation(ItemStack stack) {
		return ItemUseAnimation.TRIDENT;
	}

	@Override
	public int getUseDuration(ItemStack stack, LivingEntity entity) {
		return 72000;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (player instanceof ServerPlayer sp && Tether.release(sp)) return InteractionResult.SUCCESS_SERVER;
		ItemStack stack = player.getItemInHand(hand);
		if (stack.nextDamageWillBreak()) return InteractionResult.FAIL;
		player.startUsingItem(hand);
		return InteractionResult.CONSUME;
	}

	@Override
	public boolean releaseUsing(ItemStack stack, Level level, LivingEntity entity, int remaining) {
		if (!(entity instanceof Player player)) return false;
		HuntingData.Harpoon h = HuntingData.HARPOONS.get("harpoon");
		int ticks = this.getUseDuration(stack, entity) - remaining;
		if (ticks < h.minDraw()) return false;
		if (level instanceof ServerLevel server) {
			boolean wet = player.isEyeInFluid(FluidTags.WATER);
			float draw = Math.min(1F, ticks / 20F);
			stack.hurtWithoutBreaking(1, player);
			ItemStack thrown = stack.consumeAndReturn(1, player);
			ThrownHarpoon harpoon = new ThrownHarpoon(HuntingRegistry.THROWN_HARPOON, server, player, thrown);
			harpoon.shootFromRotation(player, player.getXRot(), player.getYRot(), 0, (float) (h.speed() * draw * (wet ? 1 : 0.8)), 1.0F);
			harpoon.power = (wet ? h.powerWater() : h.powerAir()) * (0.5 + 0.5 * draw);
			if (player.hasInfiniteMaterials()) harpoon.pickup = AbstractArrow.Pickup.CREATIVE_ONLY;
			server.addFreshEntity(harpoon);
			server.playSound(null, harpoon, SoundEvents.TRIDENT_THROW.value(), SoundSource.PLAYERS, 1.0F, 1.0F);
			if (!wet) player.sendOverlayMessage(Component.translatable("hunting.hud.harpoon_weak"));
			Senses.makeNoise(player, 4, 20);
		}
		return true;
	}
}
