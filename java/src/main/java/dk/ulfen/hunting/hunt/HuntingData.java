package dk.ulfen.hunting.hunt;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;

/** Zones, calibres and firearms shared with the Bedrock pack (data/hunting/hunting.json, generated). */
public final class HuntingData {
	public record Zone(String fate, double bleedSeconds, double damage, double density, boolean vital, String blood, double slows) {}

	public record Calibre(String name, double velocity, double energy, double drag, double penetration, double range, int pellets, double spread) {
		public boolean isShot() {
			return pellets > 1;
		}
	}

	public record Firearm(String calibre, String ammo, List<Integer> zoom, int cycle, double sway) {}

	private record Json(Map<String, Zone> zones, List<String> priority, Map<String, Calibre> calibres, Map<String, Firearm> firearms) {}

	public static Map<String, Zone> ZONES;
	public static List<String> PRIORITY;
	public static Map<String, Calibre> CALIBRES;
	public static Map<String, Firearm> FIREARMS;

	private HuntingData() {}

	public static void load() {
		try (InputStream in = HuntingData.class.getResourceAsStream("/data/hunting/hunting.json")) {
			if (in == null) throw new IllegalStateException("hunting.json missing from the mod jar (run `npm run build`)");
			Json j = new Gson().fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), Json.class);
			ZONES = j.zones();
			PRIORITY = j.priority();
			CALIBRES = j.calibres();
			FIREARMS = j.firearms();
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
