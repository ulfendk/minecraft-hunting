package dk.ulfen.hunting.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.blaze3d.platform.InputConstants;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.item.RifleItem;
import dk.ulfen.hunting.net.HuntingNetwork;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * Client side of aiming (the Java twin of the scope handling in scripts/shooting.js):
 * hold right-click to aim, left-click fires, tap sneak (or Z) for the next zoom level, hold
 * sneak to steady your aim and hold your breath. Also keeps the latest shot report.
 */
public final class ClientHunting {
	static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(HuntingRegistry.id("hunting"));
	public static final KeyMapping REPORT = new KeyMapping("key.hunting.report", InputConstants.Type.KEYBOARD, InputConstants.KEY_R, CATEGORY);
	public static final KeyMapping ZOOM = new KeyMapping("key.hunting.zoom", InputConstants.Type.KEYBOARD, InputConstants.KEY_Z, CATEGORY);

	public static @Nullable String firearm;
	public static int zoom;
	public static double breath = 100;
	public static boolean holding;
	public static int shaky;
	private static int sneakTicks = -1;
	private static double swayT = Math.random() * 1000, swayX, swayY;
	public static String range = "—";

	/** The latest shot report, and until when (game time) its x-ray shows on the HUD. */
	public static @Nullable JsonObject lastReport;
	public static long flashUntil;

	private ClientHunting() {}

	public static void init() {
		KeyMappingHelper.registerKeyMapping(REPORT);
		KeyMappingHelper.registerKeyMapping(ZOOM);
		ClientTickEvents.START_CLIENT_TICK.register(ClientHunting::tick);
		ClientPlayNetworking.registerGlobalReceiver(HuntingNetwork.ReportPayload.TYPE, (payload, context) -> {
			lastReport = JsonParser.parseString(payload.json()).getAsJsonObject();
			if (payload.flash() && context.client().level != null) flashUntil = context.client().level.getGameTime() + 100;
		});
		ClientPlayNetworking.registerGlobalReceiver(HuntingNetwork.JournalPayload.TYPE, (payload, context) ->
			context.client().gui.setScreen(new JournalScreen(JsonParser.parseString(payload.json()).getAsJsonObject())));
	}

	public static @Nullable String aimingFirearm(@Nullable LocalPlayer p) {
		if (p == null || !p.isUsingItem() || !(p.getUseItem().getItem() instanceof RifleItem rifle)) return null;
		return rifle.firearm();
	}

	public static boolean usingBinoculars(AbstractClientPlayer p) {
		return p.isUsingItem() && p.getUseItem().is(HuntingRegistry.item("binoculars"));
	}

	/** Zoom FOV in degrees for the current scope setting. */
	public static double scopeFov() {
		HuntingData.Firearm f = firearm == null ? null : HuntingData.FIREARMS.get(firearm);
		if (f == null || f.zoom() == null || f.zoom().isEmpty()) return 70;
		return f.zoom().get(Math.min(zoom, f.zoom().size() - 1));
	}

	/** FOV multiplier for the mixin: below 1 while aiming a rifle or looking through binoculars. */
	public static float fovModifier(AbstractClientPlayer player) {
		Minecraft mc = Minecraft.getInstance();
		if (player != mc.player) return 1;
		double base = mc.options.fov().get();
		if (aimingFirearm(mc.player) != null) return (float) (scopeFov() / base);
		if (usingBinoculars(player)) return (float) (20 / base);
		return 1;
	}

	private static double wobble(double t, double seed) {
		return Math.sin(t * 0.9 + seed) * 0.6 + Math.sin(t * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * 5.1 + seed * 0.3) * 0.1;
	}

	private static void tick(Minecraft mc) {
		LocalPlayer p = mc.player;
		while (REPORT.consumeClick()) {
			if (lastReport != null) mc.gui.setScreen(new ShotReportScreen(lastReport, null));
		}
		String aiming = aimingFirearm(p);
		if (aiming == null) {
			firearm = null;
			sneakTicks = -1;
			holding = false;
			breath = Math.min(100, breath + 0.8);
			swayX = swayY = 0;
			return;
		}
		if (!aiming.equals(firearm)) {
			firearm = aiming;
			zoom = 0;
		}
		// Left click while aiming fires (vanilla would swallow the click while an item is in use).
		while (mc.options.keyAttack.consumeClick()) ClientPlayNetworking.send(new HuntingNetwork.FirePayload());
		HuntingData.Firearm f = HuntingData.FIREARMS.get(aiming);
		while (ZOOM.consumeClick()) zoom = (zoom + 1) % f.zoom().size();

		// Sneak: tap = next zoom level, hold = hold your breath.
		if (mc.options.keyShift.isDown()) {
			if (sneakTicks < 0) sneakTicks = 0;
			sneakTicks++;
			if (sneakTicks > 6 && shaky <= 0) {
				holding = true;
				breath -= 1;
				if (breath <= 0) {
					holding = false;
					shaky = 60;
				}
			}
		} else {
			if (sneakTicks >= 0 && sneakTicks <= 6) {
				zoom = (zoom + 1) % f.zoom().size();
				p.playSound(net.minecraft.sounds.SoundEvents.UI_BUTTON_CLICK.value(), 0.3F, 1.8F);
			}
			sneakTicks = -1;
			holding = false;
			breath = Math.min(100, breath + 0.8);
		}
		if (shaky > 0) shaky--;

		// Sway, in degrees.
		double amp = 0.15 * f.sway();
		if (p.isShiftKeyDown()) amp *= 0.45;
		if (holding) amp *= 0.12;
		if (shaky > 0) amp *= 2.5;
		Vec3 v = p.getDeltaMovement();
		if (Math.hypot(v.x, v.z) > 0.05) amp *= 3;
		swayT += 0.05;
		double tx = wobble(swayT, 1.3) * amp, ty = wobble(swayT, 7.9) * amp;
		p.setXRot((float) (p.getXRot() + (tx - swayX)));
		p.setYRot((float) (p.getYRot() + (ty - swayY)));
		swayX = tx;
		swayY = ty;

		if (p.tickCount % 4 == 0) range = rangeTo(mc, p);
	}

	/** Range finder: distance to what the crosshair is on. */
	private static String rangeTo(Minecraft mc, LocalPlayer p) {
		Vec3 eye = p.getEyePosition();
		Vec3 dir = p.getViewVector(1.0F);
		HitResult block = p.pick(320, 1.0F, true);
		double best = block.getType() == HitResult.Type.MISS ? Double.MAX_VALUE : block.getLocation().distanceTo(eye);
		Vec3 end = eye.add(dir.scale(Math.min(320, best)));
		if (mc.level != null) {
			for (Entity e : mc.level.getEntities(p, new AABB(eye, end).inflate(1), x -> x.isPickable())) {
				var hit = e.getBoundingBox().inflate(0.2).clip(eye, end);
				if (hit.isPresent()) best = Math.min(best, hit.get().distanceTo(eye));
			}
		}
		return best == Double.MAX_VALUE ? "—" : String.valueOf(Math.round(best));
	}
}
