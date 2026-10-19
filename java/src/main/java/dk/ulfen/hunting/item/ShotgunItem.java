package dk.ulfen.hunting.item;

import dk.ulfen.hunting.hunt.Shooting;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.Level;

/** The shotgun fires on right-click (no scope): a spread of pellets for birds and hares. */
public class ShotgunItem extends Item {
	public ShotgunItem(Item.Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (hand != InteractionHand.MAIN_HAND) return InteractionResult.PASS;
		if (player instanceof ServerPlayer sp) Shooting.fire(sp, "shotgun");
		return InteractionResult.SUCCESS;
	}
}
