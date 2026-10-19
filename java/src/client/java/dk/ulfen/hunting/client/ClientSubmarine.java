package dk.ulfen.hunting.client;

import com.mojang.blaze3d.platform.InputConstants;

import dk.ulfen.hunting.entity.MiniSubmarine;
import dk.ulfen.hunting.net.HuntingNetwork;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.jspecify.annotations.Nullable;

/**
 * The submarine pilot's controls: W/S (as vanilla) drive it the way you look, Space rises,
 * the dive key (V) sinks and G switches the lamps off and on. The movement is simulated on the
 * pilot's client (like a boat), so the vertical input goes straight to the sub; the server gets
 * it, with the throttle, in a {@link HuntingNetwork.SubControlPayload}.
 */
public final class ClientSubmarine {
	public static final KeyMapping DOWN = new KeyMapping("key.hunting.sub_down", InputConstants.Type.KEYBOARD, InputConstants.KEY_V, ClientHunting.CATEGORY);
	public static final KeyMapping LIGHTS = new KeyMapping("key.hunting.sub_lights", InputConstants.Type.KEYBOARD, InputConstants.KEY_G, ClientHunting.CATEGORY);

	private static int lastVertical, lastForward;
	private static int quiet;

	private ClientSubmarine() {}

	public static void init() {
		KeyMappingHelper.registerKeyMapping(DOWN);
		KeyMappingHelper.registerKeyMapping(LIGHTS);
		ClientTickEvents.END_CLIENT_TICK.register(ClientSubmarine::tick);
	}

	/** The sub the local player is piloting. */
	public static @Nullable MiniSubmarine piloting(Minecraft mc) {
		if (mc.player != null && mc.player.getVehicle() instanceof MiniSubmarine sub && sub.getControllingPassenger() == mc.player) return sub;
		return null;
	}

	private static void tick(Minecraft mc) {
		MiniSubmarine sub = piloting(mc);
		if (sub == null) {
			while (LIGHTS.consumeClick()) {}
			return;
		}
		boolean toggled = false;
		while (LIGHTS.consumeClick()) toggled = true;
		int vertical = mc.options.keyJump.isDown() ? 1 : DOWN.isDown() ? -1 : 0;
		float zza = mc.player.zza;
		int forward = zza > 0 ? 1 : zza < 0 ? -1 : 0;
		sub.vertical = vertical;
		// Send while keys are held (the server stops the sub when packets stop coming).
		if (vertical != 0 || forward != 0 || toggled || vertical != lastVertical || forward != lastForward || ++quiet > 20) {
			quiet = 0;
			lastVertical = vertical;
			lastForward = forward;
			ClientPlayNetworking.send(new HuntingNetwork.SubControlPayload(sub.getId(), vertical, forward, toggled ? 1 : 0));
		}
	}
}
