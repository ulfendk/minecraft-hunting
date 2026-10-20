package dk.ulfen.hunting.species;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.EntityType;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Loads data/hunting/species.json from the mod jar at startup, plus the creatures other mods
 * offer as game: every mod's hunting/targets/*.json (an array of hunting target profiles,
 * the same format the Bedrock add-ons send as script events; see lib/protocol.js).
 */
public final class SpeciesRegistry {
	private static final Logger LOG = LoggerFactory.getLogger("hunting");
	private static final int PROTOCOL = 1;
	private static final Map<String, Species> BY_ID = new LinkedHashMap<>();
	private static final Map<String, Species> FOREIGN = new LinkedHashMap<>();
	private static final Gson GSON = new Gson();

	private SpeciesRegistry() {}

	public static void load() {
		try (InputStream in = SpeciesRegistry.class.getResourceAsStream("/data/hunting/species.json")) {
			if (in == null) throw new IllegalStateException("species.json missing from the mod jar (run `npm run build`)");
			List<Species> list = GSON.fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), new TypeToken<List<Species>>() {}.getType());
			for (Species s : list) BY_ID.put(s.id(), s);
		} catch (java.io.IOException e) {
			throw new IllegalStateException("Could not read species.json", e);
		}
		for (ModContainer mod : FabricLoader.getInstance().getAllMods()) {
			mod.findPath("hunting/targets").ifPresent(dir -> loadTargets(mod.getMetadata().getId(), dir));
		}
		if (!FOREIGN.isEmpty()) LOG.info("Realistic Hunting: {} creatures from other mods are game", FOREIGN.size());
	}

	private static void loadTargets(String mod, Path dir) {
		try (Stream<Path> files = Files.list(dir)) {
			for (Path f : files.filter(p -> p.toString().endsWith(".json")).toList()) {
				try (Reader r = Files.newBufferedReader(f, StandardCharsets.UTF_8)) {
					for (JsonElement e : JsonParser.parseReader(r).getAsJsonArray()) {
						Species s = fromProfile(e.getAsJsonObject());
						if (s != null) FOREIGN.put(s.id(), s);
						else LOG.warn("Realistic Hunting: skipped a bad hunting target in {} ({})", mod, f.getFileName());
					}
				}
			}
		} catch (Exception e) {
			LOG.warn("Realistic Hunting: could not read {}'s hunting targets", mod, e);
		}
	}

	private static boolean has(JsonObject o, String key) {
		return o.has(key) && !o.get(key).isJsonNull();
	}

	/** A hunting target profile as a Species (only the hunting fields are filled in). */
	public static @Nullable Species fromProfile(JsonObject p) {
		if (!has(p, "v") || p.get("v").getAsInt() != PROTOCOL || !has(p, "id") || !has(p, "game") || !has(p, "hitModel")) return null;
		String id = p.get("id").getAsString();
		if (!id.contains(":") || id.startsWith("hunting:")) return null;
		try {
			JsonObject g = p.getAsJsonObject("game");
			JsonObject s = new JsonObject();
			s.addProperty("id", id);
			s.addProperty("kind", "foreign");
			if (has(p, "name")) s.addProperty("name", p.get("name").getAsString());
			s.addProperty("sex", has(p, "sex") ? p.get("sex").getAsString() : "random");
			s.addProperty("modelScale", has(p, "modelScale") ? p.get("modelScale").getAsDouble() : 1);
			s.addProperty("scale", has(p, "scale") ? p.get("scale").getAsDouble() : 1);
			s.addProperty("health", has(p, "health") ? p.get("health").getAsDouble() : 10);
			s.addProperty("bird", has(p, "bird") && p.get("bird").getAsBoolean());
			s.addProperty("movement", has(p, "fish") && p.get("fish").getAsBoolean() ? "swim" : "walk");
			JsonObject game = new JsonObject();
			game.addProperty("gameClass", g.get("class").getAsString());
			game.addProperty("minEnergy", g.get("minEnergy").getAsDouble());
			game.addProperty("minShotEnergy", has(g, "minShotEnergy") ? g.get("minShotEnergy").getAsDouble() : 4);
			JsonArray w = g.getAsJsonArray("weight");
			game.addProperty("weightMin", w.get(0).getAsDouble());
			game.addProperty("weightMax", w.get(1).getAsDouble());
			game.addProperty("score", g.get("score").getAsDouble());
			if (has(g, "trophy")) game.addProperty("trophy", g.get("trophy").getAsString());
			game.addProperty("maleTrophy", has(g, "maleTrophy") && g.get("maleTrophy").getAsBoolean());
			if (has(g, "call")) game.addProperty("call", g.get("call").getAsString());
			s.add("game", game);
			s.add("senses", p.get("senses"));
			s.add("hitModel", p.get("hitModel"));
			if (has(p, "hitModelFemale")) s.add("hitModelFemale", p.get("hitModelFemale"));
			s.add("loot", has(p, "loot") ? p.get("loot") : new JsonArray());
			if (has(p, "sounds") && p.get("sounds").isJsonObject()) {
				JsonObject in = p.getAsJsonObject("sounds");
				JsonObject sounds = new JsonObject();
				if (has(in, "death")) sounds.addProperty("death", in.get("death").getAsString());
				JsonArray pitch = has(in, "pitch") ? in.getAsJsonArray("pitch") : null;
				sounds.addProperty("pitchMin", pitch != null ? pitch.get(0).getAsFloat() : 1);
				sounds.addProperty("pitchMax", pitch != null ? pitch.get(1).getAsFloat() : 1);
				s.add("sounds", sounds);
				if (has(in, "warn")) s.addProperty("warnSound", in.get("warn").getAsString());
			}
			for (String list : new String[] {"hunts", "fleesFrom", "breed", "tempt", "heal", "variantTextures", "idle", "maleBones", "spawns", "xrayZones", "animations"}) {
				s.add(list, new JsonArray());
			}
			Species sp = GSON.fromJson(s, Species.class);
			sp.model(); // fail here rather than mid-hunt if the hit model is broken
			return sp;
		} catch (RuntimeException e) {
			return null;
		}
	}

	/** Our own species (the ones the mod registers entities for). */
	public static Iterable<Species> all() {
		return BY_ID.values();
	}

	/** Other mods' creatures that are game. */
	public static Iterable<Species> foreign() {
		return FOREIGN.values();
	}

	public static Species get(String id) {
		Species s = find(id);
		if (s == null) throw new IllegalArgumentException("Unknown species " + id);
		return s;
	}

	/** Our species or another mod's game by id (with namespace), or null. */
	public static @Nullable Species find(String id) {
		return id.contains(":") ? FOREIGN.get(id) : BY_ID.get(id);
	}

	/** Lang key of a species' name by the id stored in shot and trophy records. */
	public static String nameKey(String id) {
		Species s = find(id);
		return s != null ? s.nameKey() : "entity.hunting." + id;
	}

	/** Our species, then other mods' game. */
	public static List<Species> everything() {
		List<Species> out = new java.util.ArrayList<>(BY_ID.values());
		out.addAll(FOREIGN.values());
		return out;
	}

	/** Species of a hunting entity type (its registry path is the species id). */
	public static Species of(EntityType<?> type) {
		return get(BuiltInRegistries.ENTITY_TYPE.getKey(type).getPath());
	}

	/** The profile of another mod's entity type, if it's game. */
	public static @Nullable Species foreign(EntityType<?> type) {
		return FOREIGN.isEmpty() ? null : FOREIGN.get(BuiltInRegistries.ENTITY_TYPE.getKey(type).toString());
	}
}
