package dk.ulfen.hunting;

import dk.ulfen.hunting.hunt.Diving;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Journal;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Tether;
import dk.ulfen.hunting.hunt.Wounds;
import dk.ulfen.hunting.net.HuntingNetwork;
import dk.ulfen.hunting.species.SpeciesRegistry;
import dk.ulfen.hunting.world.HuntingWorldgen;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.level.ServerPlayer;

public class RealisticHunting implements ModInitializer {
	public static final String MOD_ID = "hunting";

	@Override
	public void onInitialize() {
		SpeciesRegistry.load();
		HuntingData.load();
		HuntingRegistry.register();
		HuntingWorldgen.register();
		HuntingNetwork.register();

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			Wounds.showTrails(server);
			Tether.tick(server);
			Diving.tick(server);
			if (server.getTickCount() % 40 == 0) for (ServerPlayer p : server.getPlayerList().getPlayers()) Journal.spot(p);
		});
		net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents.SERVER_STOPPING.register(server -> Tether.clear());
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> Journal.onJoin(handler.getPlayer()));
		PlayerBlockBreakEvents.AFTER.register((level, player, pos, state, blockEntity) -> Senses.makeNoise(player, 16, 20));
	}
}
