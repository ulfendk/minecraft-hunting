package dk.ulfen.hunting.item;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.BroadheadArrow;
import net.minecraft.core.Direction;
import net.minecraft.core.Position;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ArrowItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.jspecify.annotations.Nullable;

public class BroadheadArrowItem extends ArrowItem {
	public BroadheadArrowItem(Properties properties) {
		super(properties);
	}

	@Override
	public AbstractArrow createArrow(Level level, ItemStack ammo, LivingEntity owner, @Nullable ItemStack weapon) {
		return new BroadheadArrow(HuntingRegistry.BROADHEAD_ARROW, level, owner, ammo.copyWithCount(1), weapon);
	}

	@Override
	public Projectile asProjectile(Level level, Position pos, ItemStack stack, Direction direction) {
		BroadheadArrow arrow = new BroadheadArrow(HuntingRegistry.BROADHEAD_ARROW, level);
		arrow.setPos(pos.x(), pos.y(), pos.z());
		arrow.pickup = AbstractArrow.Pickup.ALLOWED;
		return arrow;
	}
}
