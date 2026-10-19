package dk.ulfen.hunting.client;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.MiniSubmarine;
import dk.ulfen.hunting.hunt.Diving;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.network.chat.Component;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;

/** The submarine's panel (battery, depth, speed, bolts) and the scuba tank's air gauge. */
public final class SubmarineHud {
	private SubmarineHud() {}

	public static void init() {
		HudElementRegistry.attachElementAfter(VanillaHudElements.HOTBAR, HuntingRegistry.id("submarine"), SubmarineHud::panel);
		HudElementRegistry.attachElementAfter(VanillaHudElements.HOTBAR, HuntingRegistry.id("scuba_tank"), SubmarineHud::tank);
		// A submarine is not an animal: no hearts for it above the hotbar.
		HudElementRegistry.replaceElement(VanillaHudElements.MOUNT_HEALTH, vanilla -> (g, delta) -> {
			Minecraft mc = Minecraft.getInstance();
			if (!(mc.player != null && mc.player.getVehicle() instanceof MiniSubmarine)) vanilla.extractRenderState(g, delta);
		});
	}

	private static void panel(GuiGraphicsExtractor g, DeltaTracker delta) {
		Minecraft mc = Minecraft.getInstance();
		MiniSubmarine sub = ClientSubmarine.piloting(mc);
		if (sub == null || mc.gui.hud.isHidden()) return;
		Font font = mc.font;
		int x = 6, y = 6, line = 11, w = 100;
		int bolts = 0;
		for (int i = 0; i < mc.player.getInventory().getContainerSize(); i++) {
			ItemStack s = mc.player.getInventory().getItem(i);
			if (s.is(HuntingRegistry.item("harpoon_bolt"))) bolts += s.getCount();
		}
		double speed = sub.getDeltaMovement().length() * 20;
		int depth = 0;
		while (depth < 64 && mc.level.getFluidState(sub.blockPosition().above(depth + 1)).is(FluidTags.WATER)) depth++;
		g.fill(x - 3, y - 3, x + 150, y + 4 * line + 1, 0x88000000);
		g.text(font, Component.translatable("entity.hunting.mini_submarine"), x, y, 0xFFE0B020, true);
		y += line;
		float battery = sub.batteryFraction();
		g.fill(x, y + 1, x + w, y + 8, 0xFF333333);
		g.fill(x, y + 1, x + Math.round(w * battery), y + 8, battery < 0.15F ? 0xFFE04040 : 0xFF40C060);
		g.text(font, Math.round(battery * 100) + "%", x + w + 4, y, 0xFFFFFFFF, true);
		y += line;
		g.text(font, Component.translatable("hunting.sub.hud", Math.round(battery * 100), depth, String.format(java.util.Locale.ROOT, "%.1f", speed)), x, y, 0xFFDDDDDD, true);
		y += line;
		Component status = Component.translatable("hunting.sub.bolts", bolts);
		if (sub.lights()) status = status.copy().append(" · ").append(Component.translatable("hunting.sub.lights"));
		g.text(font, status, x, y, 0xFFDDDDDD, true);
	}

	private static void tank(GuiGraphicsExtractor g, DeltaTracker delta) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null || mc.gui.hud.isHidden() || !mc.player.isEyeInFluid(FluidTags.WATER)) return;
		ItemStack tank = mc.player.getItemBySlot(EquipmentSlot.CHEST);
		if (!Diving.isTank(tank) || !mc.player.getItemBySlot(EquipmentSlot.HEAD).is(HuntingRegistry.item("dive_mask"))) return;
		int seconds = (Diving.air(tank) + 19) / 20;
		String key = seconds <= 0 ? "hunting.hud.tank_empty" : seconds < 60 ? "hunting.hud.tank_low" : "hunting.hud.tank";
		g.centeredText(mc.font, Component.translatable(key, seconds), g.guiWidth() / 2, g.guiHeight() - 62, 0xFF80C8FF);
	}
}
