package dk.ulfen.hunting.item;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.MiniSubmarine;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

/** Puts a mini submarine in the water (or on the ground) where the player looks, like a boat. */
public class SubmarineItem extends Item {
	public SubmarineItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		BlockHitResult hit = getPlayerPOVHitResult(level, player, ClipContext.Fluid.ANY);
		if (hit.getType() != HitResult.Type.BLOCK) return InteractionResult.PASS;
		if (!(level instanceof ServerLevel server)) return InteractionResult.SUCCESS;
		MiniSubmarine sub = HuntingRegistry.MINI_SUBMARINE.create(server, EntitySpawnReason.SPAWN_ITEM_USE);
		if (sub == null) return InteractionResult.FAIL;
		Vec3 at = hit.getLocation();
		boolean water = level.getFluidState(hit.getBlockPos()).is(FluidTags.WATER);
		// Into the water, it settles just under the surface; on land it sits on top of the block.
		double y = water ? hit.getBlockPos().getY() : at.y;
		sub.snapTo(at.x, y, at.z, player.getYRot(), 0);
		sub.setYBodyRot(player.getYRot());
		sub.setYHeadRot(player.getYRot());
		if (!level.noCollision(sub, sub.getBoundingBox().deflate(0.05))) {
			player.sendOverlayMessage(Component.translatable("hunting.sub.no_room"));
			return InteractionResult.FAIL;
		}
		server.addFreshEntity(sub);
		server.playSound(null, sub.blockPosition(), water ? SoundEvents.BUCKET_EMPTY : SoundEvents.IRON_GOLEM_REPAIR, sub.getSoundSource(), 0.8F, 1.2F);
		stack.consume(1, player);
		return InteractionResult.SUCCESS_SERVER;
	}
}
