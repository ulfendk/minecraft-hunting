package dk.ulfen.hunting.hunt;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;

/**
 * Zones, calibres, firearms and the spearfishing settings shared with the Bedrock pack
 * (data/hunting/hunting.json, generated from src/weapons.mjs, src/diving.mjs and src/submarine.mjs).
 */
public final class HuntingData {
	public record Zone(String fate, double bleedSeconds, double damage, double density, boolean vital, String blood, double slows) {}

	/** `projectile`: a real projectile (arrow, harpoon) that kills by bleeding, so no minimum energy. */
	public record Calibre(String name, double velocity, double energy, double drag, double penetration, double range, int pellets, double spread, boolean projectile) {
		public boolean isShot() {
			return pellets > 1;
		}
	}

	public record Firearm(String calibre, String ammo, List<Integer> zoom, int cycle, double sway) {}

	/** The speargun and the hand harpoon (src/weapons.mjs HARPOONS). */
	public record Harpoon(String calibre, String projectile, double speed, int loadTicks, int minDraw, double powerWater, double powerAir, double line) {}

	/** Reeling in a fish on a line (src/weapons.mjs LINE). */
	public record Line(double pull, double fight, int snapTicks, double landed) {}

	/** Diving gear (src/diving.mjs DIVE). */
	public record Dive(int tankSeconds, double refillPerSecond, double snorkelClearance, float knifeBonus) {}

	/** The mini submarine (src/submarine.mjs SUB). */
	public record Sub(double speed, double accel, double vertical, double turn, double drag, double battery, Drain drain, Map<String, Double> charge,
		float breakAt, float health, Launcher launcher, double line, double winch, int lightsBelow, List<Float> size) {
		public record Drain(double idle, double thrust, double lights) {}

		public record Launcher(String ammo, String projectile, int cooldown, double speed, double power) {}
	}

	private record Json(Map<String, Zone> zones, List<String> priority, Map<String, Calibre> calibres, Map<String, Firearm> firearms,
		Map<String, Harpoon> harpoons, Line line, Dive dive, Sub submarine) {}

	public static Map<String, Zone> ZONES;
	public static List<String> PRIORITY;
	public static Map<String, Calibre> CALIBRES;
	public static Map<String, Firearm> FIREARMS;
	public static Map<String, Harpoon> HARPOONS;
	public static Line LINE;
	public static Dive DIVE;
	public static Sub SUB;

	private HuntingData() {}

	public static void load() {
		try (InputStream in = HuntingData.class.getResourceAsStream("/data/hunting/hunting.json")) {
			if (in == null) throw new IllegalStateException("hunting.json missing from the mod jar (run `npm run build`)");
			Json j = new Gson().fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), Json.class);
			ZONES = j.zones();
			PRIORITY = j.priority();
			CALIBRES = j.calibres();
			FIREARMS = j.firearms();
			HARPOONS = j.harpoons();
			LINE = j.line();
			DIVE = j.dive();
			SUB = j.submarine();
		} catch (java.io.IOException e) {
			throw new IllegalStateException("Could not read hunting.json", e);
		}
	}

	public static Zone zone(String id) {
		return ZONES.get(id);
	}

	public static int rank(String zone) {
		int i = PRIORITY.indexOf(zone);
		return i < 0 ? Integer.MAX_VALUE : i;
	}
}
