package dk.ulfen.hunting.item;

import java.util.function.Predicate;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.HarpoonBolt;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Tether;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.item.CrossbowItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.jspecify.annotations.Nullable;

/**
 * A speargun works like a crossbow: hold use to pull back the bands and load a harpoon bolt,
 * use again to fire. It is made for water: fired through the air the bolt is slow and weak.
 * With a fish on the line, using it lets go of the line instead.
 */
public class SpeargunItem extends CrossbowItem {
	public SpeargunItem(Properties properties) {
		super(properties);
	}

	private static Predicate<ItemStack> bolts() {
		return s -> s.is(HuntingRegistry.item("harpoon_bolt"));
	}

	@Override
	public Predicate<ItemStack> getAllSupportedProjectiles() {
		return bolts();
	}

	@Override
	public Predicate<ItemStack> getSupportedHeldProjectiles() {
		return bolts();
	}

	@Override
	public int getDefaultProjectileRange() {
		return 16;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (player instanceof ServerPlayer sp && Tether.release(sp)) return InteractionResult.SUCCESS_SERVER;
		// Creative players would otherwise load a vanilla arrow: a speargun needs a bolt.
		ItemStack gun = player.getItemInHand(hand);
		if (!isCharged(gun) && !player.getInventory().hasAnyMatching(bolts())) {
			player.sendOverlayMessage(Component.translatable("hunting.hud.no_ammo", Component.translatable("item.hunting.harpoon_bolt")));
			return InteractionResult.FAIL;
		}
		return super.use(level, player, hand);
	}

	@Override
	protected void shootProjectile(LivingEntity shooter, Projectile projectile, int index, float velocity, float inaccuracy, float angle, @Nullable LivingEntity target) {
		HuntingData.Harpoon h = HuntingData.HARPOONS.get("speargun");
		boolean wet = shooter.isEyeInFluid(FluidTags.WATER);
		if (projectile instanceof HarpoonBolt bolt) bolt.power = wet ? h.powerWater() : h.powerAir();
		if (!wet && shooter instanceof Player p) p.sendOverlayMessage(Component.translatable("hunting.hud.harpoon_weak"));
		super.shootProjectile(shooter, projectile, index, (float) (h.speed() * (wet ? 1 : 0.6)), inaccuracy, angle, target);
	}
}
