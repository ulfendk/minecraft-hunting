package dk.ulfen.hunting.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.Ballistics;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Wind;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.CameraType;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

/**
 * The scope (a round field of view with a duplex reticle and holdover marks computed for the
 * rifle's calibre at the current zoom) and the x-ray flash after a hit.
 */
public final class HuntingHud {
	private static final int BLACK = 0xFF000000, INK = 0xFF0C0C0C;
	private static final int[] HOLDOVER = {150, 200, 250, 300};

	private HuntingHud() {}

	public static void init() {
		HudElementRegistry.attachElementBefore(VanillaHudElements.CROSSHAIR, HuntingRegistry.id("scope"), HuntingHud::scope);
		HudElementRegistry.attachElementAfter(VanillaHudElements.CROSSHAIR, HuntingRegistry.id("xray"), HuntingHud::xray);
	}

	private static void scope(GuiGraphicsExtractor g, DeltaTracker delta) {
		Minecraft mc = Minecraft.getInstance();
		if (ClientHunting.firearm == null || mc.options.getCameraType() != CameraType.FIRST_PERSON) return;
		HuntingData.Firearm f = HuntingData.FIREARMS.get(ClientHunting.firearm);
		HuntingData.Calibre c = HuntingData.CALIBRES.get(f.calibre());
		int w = g.guiWidth(), h = g.guiHeight();
		int cx = w / 2, cy = h / 2;
		double r = h / 2.0 - 2;
		// Everything outside the round lens is black.
		for (int y = 0; y < h; y++) {
			double dy = y + 0.5 - cy;
			if (Math.abs(dy) >= r) {
				g.fill(0, y, w, y + 1, BLACK);
				continue;
			}
			int half = (int) Math.round(Math.sqrt(r * r - dy * dy));
			g.fill(0, y, cx - half, y + 1, BLACK);
			g.fill(cx + half, y, w, y + 1, BLACK);
		}
		// Duplex reticle.
		int inner = (int) (r * 0.42);
		g.fill(cx - (int) r, cy - 1, cx - inner, cy + 1, INK);
		g.fill(cx + inner, cy - 1, cx + (int) r, cy + 1, INK);
		g.fill(cx - 1, cy + inner, cx + 1, cy + (int) r, INK);
		g.fill(cx - 1, cy - (int) r, cx + 1, cy - inner, INK);
		g.fill(cx - inner, cy, cx + inner, cy + 1, INK);
		g.fill(cx, cy - inner, cx + 1, cy + inner, INK);
		// Holdover ticks at the right angles for this calibre and zoom.
		double fov = ClientHunting.scopeFov();
		for (int i = 0; i < HOLDOVER.length; i++) {
			double angle = -Ballistics.heightAt(c, HOLDOVER[i]) / HOLDOVER[i];
			int dy = (int) Math.round(h / 2.0 * Math.tan(angle) / Math.tan(Math.toRadians(fov / 2)));
			if (dy < 2 || dy > inner - 2) continue;
			int half = 2 + i;
			g.fill(cx - half, cy + dy, cx + half + 1, cy + dy + 1, INK);
		}
		// Zoom, range, wind and breath along the bottom.
		Wind wind = Wind.at(mc.level == null ? 0 : mc.level.getGameTime());
		Component line = Component.translatable("hunting.hud.scope", String.valueOf(Math.round(70 / fov)), ClientHunting.range,
			Component.translatable("hunting.wind.short", Component.translatable("hunting.wind.arrow." + wind.compass()), String.format(java.util.Locale.ROOT, "%.1f", wind.speed())));
		int ty = cy + (int) (r * 0.62);
		g.centeredText(mc.font, line, cx, ty, 0xFFE8E8E8);
		if (ClientHunting.holding) g.centeredText(mc.font, Component.translatable("hunting.hud.steady"), cx, ty + 11, 0xFF80FF80);
		else if (ClientHunting.shaky > 0) g.centeredText(mc.font, Component.translatable("hunting.hud.shaky"), cx, ty + 11, 0xFFFF6060);
	}

	/** The x-ray for a few seconds after a hit, with the bullet's entry, path and exit. */
	private static void xray(GuiGraphicsExtractor g, DeltaTracker delta) {
		Minecraft mc = Minecraft.getInstance();
		JsonObject r = ClientHunting.lastReport;
		if (r == null || mc.level == null || mc.level.getGameTime() > ClientHunting.flashUntil) return;
		int w = Math.min(256, g.guiWidth() / 2), hgt = w / 2;
		draw(g, r, (g.guiWidth() - w) / 2, 8, w, hgt);
	}

	/** Draw a report's x-ray at (x, y) sized w x h, with entry/exit markers. */
	public static void draw(GuiGraphicsExtractor g, JsonObject r, int x, int y, int w, int h) {
		String species = r.get("species").getAsString();
		String zone = r.has("zone") ? r.get("zone").getAsString() : null;
		// Other mods' game has no x-ray pictures: the report says what was hit.
		Species s = SpeciesRegistry.find(species);
		if (s == null || s.xrayView() == null) return;
		Identifier tex = HuntingRegistry.id("textures/gui/xray/" + species + (zone == null ? "" : "_" + zone) + ".png");
		Species.XrayView v = s.xrayView();
		g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, 0, 0, w, h, v.w(), v.h(), v.w(), v.h());
		double k = (double) w / v.w();
		int[] entry = project(r.getAsJsonArray("entry"), v, k, x, y);
		int[] exit = project(r.getAsJsonArray("exit"), v, k, x, y);
		if (entry != null && exit != null) line(g, entry, exit, 0xFFFFE070);
		if (entry != null) dot(g, entry, 0xFFFF3030);
		if (exit != null) dot(g, exit, 0xFF40A0FF);
	}

	private static int[] project(JsonArray p, Species.XrayView v, double k, int x, int y) {
		if (p == null) return null;
		double u = -p.get(2).getAsDouble(), vv = p.get(1).getAsDouble();
		return new int[] {x + (int) Math.round((u * v.scale() + v.ox()) * k), y + (int) Math.round((v.oy() - vv * v.scale()) * k)};
	}

	private static void dot(GuiGraphicsExtractor g, int[] p, int color) {
		g.fill(p[0] - 2, p[1] - 2, p[0] + 3, p[1] + 3, 0xFF000000);
		g.fill(p[0] - 1, p[1] - 1, p[0] + 2, p[1] + 2, color);
	}

	private static void line(GuiGraphicsExtractor g, int[] a, int[] b, int color) {
		int n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
		for (int i = 0; i <= n; i++) {
			int px = a[0] + (n == 0 ? 0 : (b[0] - a[0]) * i / n), py = a[1] + (n == 0 ? 0 : (b[1] - a[1]) * i / n);
			g.fill(px, py, px + 1, py + 1, color);
		}
	}
}
