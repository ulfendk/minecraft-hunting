package dk.ulfen.hunting.hunt;

import dk.ulfen.hunting.HuntingRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;

/**
 * Diving gear (the Java twin of scripts/diving.js). A snorkel keeps your air full while your
 * head is just under the surface. A dive mask with a scuba tank keeps it full anywhere under
 * water (with clear vision) until the tank is empty; the tank's air (hunting:air, in ticks)
 * fills up again out of the water or in a submarine.
 */
public final class Diving {
	public static final int STEP = 10;

	private Diving() {}

	public static int maxAir() {
		return HuntingData.DIVE.tankSeconds() * 20;
	}

	public static boolean isTank(ItemStack stack) {
		return stack.is(HuntingRegistry.item("scuba_tank"));
	}

	public static int air(ItemStack tank) {
		return tank.getOrDefault(HuntingRegistry.AIR, maxAir());
	}

	public static void setAir(ItemStack tank, int air) {
		tank.set(HuntingRegistry.AIR, Math.max(0, Math.min(maxAir(), air)));
	}

	/** A submarine tops the tank up. */
	public static void refillTank(ServerPlayer player) {
		ItemStack tank = player.getItemBySlot(EquipmentSlot.CHEST);
		if (isTank(tank) && air(tank) < maxAir()) setAir(tank, maxAir());
	}

	/** Every server tick (works every STEP ticks). */
	public static void tick(MinecraftServer server) {
		if (server.getTickCount() % STEP != 0) return;
		for (ServerPlayer player : server.getPlayerList().getPlayers()) tickPlayer(player);
	}

	/** One player's gear, every STEP ticks. */
	public static void tickPlayer(ServerPlayer player) {
		HuntingData.Dive cfg = HuntingData.DIVE;
		ItemStack head = player.getItemBySlot(EquipmentSlot.HEAD);
		ItemStack chest = player.getItemBySlot(EquipmentSlot.CHEST);
		boolean under = player.isEyeInFluid(FluidTags.WATER);

		if (under && head.is(HuntingRegistry.item("snorkel"))) {
			// The tube reaches the surface while the water above your eyes is shallow.
			Vec3 eye = player.getEyePosition();
			BlockPos above = BlockPos.containing(eye.x, eye.y + cfg.snorkelClearance(), eye.z);
			if (!player.level().getFluidState(above).is(FluidTags.WATER)) player.setAirSupply(player.getMaxAirSupply());
		}

		if (!isTank(chest)) return;
		int air = air(chest);
		if (under && head.is(HuntingRegistry.item("dive_mask"))) {
			if (air > 0) {
				player.setAirSupply(player.getMaxAirSupply());
				player.addEffect(new MobEffectInstance(MobEffects.CONDUIT_POWER, STEP + 30, 0, true, false, true));
				if (!player.hasInfiniteMaterials()) setAir(chest, air - STEP);
				if (air - STEP <= 0) {
					player.sendOverlayMessage(Component.translatable("hunting.hud.tank_empty"));
					player.level().playSound(null, player.blockPosition(), SoundEvents.NOTE_BLOCK_BASS.value(), SoundSource.PLAYERS, 1.0F, 0.5F);
				}
			}
		} else if (!under && air < maxAir()) {
			setAir(chest, air + (int) Math.round(cfg.refillPerSecond() * STEP));
		}
	}
}
