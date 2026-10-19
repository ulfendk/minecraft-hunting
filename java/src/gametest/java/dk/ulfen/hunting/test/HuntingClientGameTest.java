package dk.ulfen.hunting.test;

import java.util.List;

import com.google.gson.JsonParser;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.client.ShotReportScreen;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;

/**
 * Starts a real client, lines up the animals in front of the camera and takes screenshots,
 * then looks through a rifle scope and opens a shot report (run with
 * `./gradlew runClientGameTest`; images land in build/run/clientGameTest/screenshots).
 */
public class HuntingClientGameTest implements FabricClientGameTest {
	private static final String SAMPLE_REPORT = """
		{"id":1,"species":"white_tailed_deer","distance":142,"calibre":".308 Winchester","energy":2620,"accuracy":91,"grade":"perfect",
		"fate":"mortal","bleed":4,"zones":[["shoulder",35],["lungs",62],["heart",100]],"entrySide":"left","exitSide":"right",
		"entry":[3.0,14.5,-6.0],"exit":[-3.0,14.0,-5.5],"notes":[],"pellets":1,"pelletsHit":1,"blood":"bright","zone":"heart","male":true}""";

	@Override
	public void runTest(ClientGameTestContext context) {
		try (TestSingleplayerContext world = context.worldBuilder().create()) {
			world.getServer().runCommand("gamerule doDaylightCycle false");
			world.getServer().runCommand("gamerule doMobSpawning false");
			world.getServer().runCommand("time set noon");
			world.getServer().runCommand("weather clear");
			context.waitTicks(20);

			List<String> only = System.getProperty("hunting.screenshot") == null ? List.of() : List.of(System.getProperty("hunting.screenshot").split(","));
			List<String> ids = HuntingRegistry.ANIMALS.keySet().stream().filter(id -> only.isEmpty() || only.contains(id)).toList();
			for (int group = 0; group * 3 < ids.size(); group++) {
				world.getServer().runCommand("kill @e[type=!player]");
				int z = group * 40;
				for (int i = 0; i < 3 && group * 3 + i < ids.size(); i++) {
					int x = (i - 1) * 4;
					world.getServer().runCommand("summon hunting:" + ids.get(group * 3 + i) + " " + x + " -60 " + z + " {NoAI:1b,Rotation:[150f,0f]}");
				}
				world.getServer().runCommand("tp @p 0 -58 " + (z - 7) + " 0 18");
				context.waitTicks(40);
				context.takeScreenshot("hunting_group_" + group);
			}

			// Through the scope of a .308 at a deer 40 blocks away.
			world.getServer().runCommand("kill @e[type=!player]");
			world.getServer().runCommand("summon hunting:white_tailed_deer 0 -60 40 {NoAI:1b,Rotation:[90f,0f]}");
			world.getServer().runCommand("tp @p 0 -60 0 0 0");
			world.getServer().runCommand("item replace entity @p hotbar.0 with hunting:rifle_308");
			context.runOnClient(client -> client.player.getInventory().setSelectedSlot(0));
			context.waitTicks(30);
			context.getInput().holdKey(options -> options.keyUse);
			context.waitTicks(20);
			context.takeScreenshot("hunting_scope");
			context.getInput().releaseKey(options -> options.keyUse);

			// The shot report.
			context.setScreen(() -> new ShotReportScreen(JsonParser.parseString(SAMPLE_REPORT).getAsJsonObject(), null));
			context.waitTicks(5);
			context.takeScreenshot("hunting_report");
			context.setScreen(() -> null);
		}
	}
}
