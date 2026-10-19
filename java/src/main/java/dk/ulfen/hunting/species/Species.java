package dk.ulfen.hunting.species;

import java.util.List;
import java.util.Set;

import com.google.gson.JsonObject;

/**
 * One animal's settings, generated from the shared specs into data/hunting/species.json
 * by tools/java.mjs. Field names match the JSON.
 */
public record Species(
	String id,
	String kind,
	float width,
	float height,
	double health,
	double speed,
	double attackDamage,
	double attackSpeed,
	boolean leap,
	double knockbackResistance,
	boolean alertsPack,
	List<String> hunts,
	int huntInterval,
	double huntRange,
	List<String> fleesFrom,
	float fleeDistance,
	double fleeSpeed,
	double panicSpeed,
	Hostile hostile,
	String sleeps,
	String movement,
	double flySpeed,
	double swimSpeed,
	boolean school,
	String attackEffect,
	List<String> variantTextures,
	boolean climbs,
	boolean fallImmune,
	boolean grazes,
	boolean wades,
	List<String> breed,
	List<String> tempt,
	List<Heal> heal,
	int variants,
	float babyScale,
	float scale,
	Ride ride,
	Sounds sounds,
	Set<String> animations,
	List<String> idle,
	double runSpeed,
	List<String> maleBones,
	List<Spawn> spawns,
	boolean companion,
	Game game,
	boolean bird,
	Senses senses,
	JsonObject hitModel,
	JsonObject hitModelFemale,
	XrayView xrayView,
	List<String> xrayZones,
	List<Loot> loot,
	String warnSound
) {
	/** Hunting data for game animals (null for the dog). */
	public record Game(String gameClass, double minEnergy, double minShotEnergy, double weightMin, double weightMax, double score,
		String trophy, boolean maleTrophy, String call) {}

	public record Senses(double sight, double hearing, double smell, double alertTime, double herd) {}

	/** Side-view projection of the x-ray image: screen = (u * scale + ox, oy - v * scale), u = -z, v = y. */
	public record XrayView(double scale, double ox, double oy, int w, int h) {}

	public record Loot(String item, int min, int max) {}

	private static final java.util.Map<String, dk.ulfen.hunting.hunt.HitZones.Model> MODELS = new java.util.concurrent.ConcurrentHashMap<>();
	private static final java.util.Map<String, dk.ulfen.hunting.hunt.HitZones.Model> FEMALE_MODELS = new java.util.concurrent.ConcurrentHashMap<>();

	public boolean isGame() {
		return game != null;
	}

	public dk.ulfen.hunting.hunt.HitZones.Model model() {
		return MODELS.computeIfAbsent(id, k -> dk.ulfen.hunting.hunt.HitZones.Model.from(hitModel));
	}

	/** The male model has the male-only parts (antlers, fan); females and young don't. */
	public dk.ulfen.hunting.hunt.HitZones.Model model(boolean adultMale) {
		if (adultMale || hitModelFemale == null) return model();
		return FEMALE_MODELS.computeIfAbsent(id, k -> dk.ulfen.hunting.hunt.HitZones.Model.from(hitModelFemale));
	}

	public record Hostile(double range, String when) {}

	public record Heal(String item, float amount) {}

	public record Ride(int seats, double seatHeight, boolean chest, boolean jump, double jumpStrength, List<String> tameItems, int temper) {}

	public record Sounds(String ambient, String hurt, String death, float pitchMin, float pitchMax, int interval) {}

	public record Spawn(List<String> biomes, int weight, int min, int max, boolean water) {}

	public boolean isMount() {
		return "mount".equals(kind);
	}

	public boolean flies() {
		return "fly".equals(movement);
	}

	public boolean amphibious() {
		return "amphibious".equals(movement);
	}

	public boolean isSwimmer() {
		return "swimmer".equals(kind);
	}

	/** Air-breathing swimmers (river dolphins) have to surface. */
	public boolean breathesAir() {
		return "dolphin".equals(movement);
	}

	public boolean climbsWalls() {
		return "climb".equals(movement);
	}

	public boolean waterOnly() {
		return !spawns.isEmpty() && spawns.stream().allMatch(Spawn::water);
	}

	public boolean attacks() {
		return attackDamage > 0;
	}

	public boolean hasAnimation(String name) {
		return animations.contains(name);
	}

	/** Full GeckoLib animation name, e.g. animation.hunting.lion.walk. */
	public String animation(String name) {
		return "animation.hunting." + id + "." + name;
	}
}
