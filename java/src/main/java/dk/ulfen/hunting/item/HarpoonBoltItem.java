package dk.ulfen.hunting.item;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.HarpoonBolt;
import dk.ulfen.hunting.entity.MiniSubmarine;
import net.minecraft.core.Direction;
import net.minecraft.core.Position;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ArrowItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.jspecify.annotations.Nullable;

/** Speargun ammunition. Used while piloting a mini submarine, it fires the sub's launcher. */
public class HarpoonBoltItem extends ArrowItem {
	public HarpoonBoltItem(Properties properties) {
		super(properties);
	}

	@Override
	public AbstractArrow createArrow(Level level, ItemStack ammo, LivingEntity owner, @Nullable ItemStack weapon) {
		return new HarpoonBolt(HuntingRegistry.HARPOON_BOLT, level, owner, ammo.copyWithCount(1), weapon);
	}

	@Override
	public Projectile asProjectile(Level level, Position pos, ItemStack stack, Direction direction) {
		HarpoonBolt bolt = new HarpoonBolt(HuntingRegistry.HARPOON_BOLT, level);
		bolt.setPos(pos.x(), pos.y(), pos.z());
		bolt.pickup = AbstractArrow.Pickup.ALLOWED;
		return bolt;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (player.getVehicle() instanceof MiniSubmarine sub && sub.getControllingPassenger() == player) {
			if (level instanceof ServerLevel server) sub.fireLauncher(server, player, player.getItemInHand(hand));
			return InteractionResult.SUCCESS;
		}
		return super.use(level, player, hand);
	}
}
