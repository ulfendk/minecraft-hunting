package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameAnimal;
import dk.ulfen.hunting.net.HuntingNetwork;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;

/**
 * Each player's shot reports, trophies and the species they've seen, kept as JSON strings in
 * player attachments (the same record shape as the Bedrock journal). The client draws them.
 */
public final class Journal {
	private static final int MAX_SHOTS = 30, MAX_TROPHIES = 60;
	private static final Gson GSON = new Gson();

	private Journal() {}

	public static List<String> shots(ServerPlayer p) {
		return p.getAttachedOrCreate(HuntingRegistry.SHOTS);
	}

	public static List<String> trophies(ServerPlayer p) {
		return p.getAttachedOrCreate(HuntingRegistry.TROPHIES);
	}

	private static void add(ServerPlayer p, net.fabricmc.fabric.api.attachment.v1.AttachmentType<List<String>> type, String entry, int max) {
		List<String> list = new ArrayList<>(p.getAttachedOrCreate(type));
		list.add(entry);
		while (list.size() > max) list.removeFirst();
		p.setAttached(type, list);
	}

	private static String color(String grade) {
		return switch (grade) {
			case "perfect" -> "§a";
			case "good" -> "§2";
			case "poor" -> "§6";
			case "unethical" -> "§c";
			default -> "§7";
		};
	}

	/** Store a shot, tell the player, and send the report to the client (x-ray flash + R to open). */
	public static long recordShot(ServerPlayer player, GameAnimal animal, HitZones.Report r, double distance, String calibre, double energy, int pellets, int pelletsHit) {
		long id = System.currentTimeMillis() % 1_000_000_000L;
		JsonObject o = new JsonObject();
		o.addProperty("id", id);
		o.addProperty("species", animal.species().id());
		o.addProperty("distance", Math.round(distance));
		o.addProperty("calibre", calibre);
		o.addProperty("energy", Math.round(energy));
		o.addProperty("accuracy", r.accuracy());
		o.addProperty("grade", r.grade());
		o.addProperty("fate", r.fate());
		o.addProperty("bleed", r.bleedSeconds());
		JsonArray zones = new JsonArray();
		for (HitZones.ZoneHit z : r.zones()) {
			JsonArray zz = new JsonArray();
			zz.add(z.zone());
			zz.add(z.percent());
			zones.add(zz);
		}
		o.add("zones", zones);
		if (r.entrySide() != null) o.addProperty("entrySide", r.entrySide());
		if (r.exitSide() != null) o.addProperty("exitSide", r.exitSide());
		if (r.entry() != null) o.add("entry", GSON.toJsonTree(r.entry()));
		if (r.exit() != null) o.add("exit", GSON.toJsonTree(r.exit()));
		o.add("notes", GSON.toJsonTree(r.notes()));
		o.addProperty("pellets", pellets);
		o.addProperty("pelletsHit", pelletsHit);
		String zone = r.primaryZone();
		o.addProperty("blood", zone == null ? "none" : HuntingData.zone(zone).blood());
		if (zone != null) o.addProperty("zone", zone);
		o.addProperty("male", animal.isMale() && !animal.isBaby());
		String json = o.toString();
		add(player, HuntingRegistry.SHOTS, json, MAX_SHOTS);

		Component name = Component.translatable("entity.hunting." + animal.species().id());
		player.sendOverlayMessage(Component.empty().append(name.copy().withStyle(ChatFormatting.BOLD))
			.append(" · " + color(r.grade())).append(Component.translatable("hunting.grade." + r.grade())).append("§r · " + r.accuracy() + "%"));
		MutableComponent line = Component.literal(color(r.grade())).append(Component.translatable("hunting.grade." + r.grade())).append("§r: ").append(name)
			.append(", " + Math.round(distance) + " m, ");
		if (zone != null) line.append(Component.translatable("hunting.zone." + zone)).append(", ");
		line.append(Component.translatable("hunting.report.accuracy", String.valueOf(r.accuracy())))
			.append(Component.literal(" ").append(Component.translatable("hunting.report.open_java")).withStyle(ChatFormatting.GRAY));
		player.sendSystemMessage(line);
		HuntingNetwork.sendReport(player, json, true);
		return id;
	}

	public static void recordTrophy(ServerPlayer player, String species, double kg, double score, String grade, long shotId, long day) {
		JsonObject t = new JsonObject();
		t.addProperty("species", species);
		t.addProperty("kg", kg);
		t.addProperty("score", score);
		t.addProperty("grade", grade);
		t.addProperty("shotId", shotId);
		t.addProperty("day", day);
		add(player, HuntingRegistry.TROPHIES, t.toString(), MAX_TROPHIES);
		// The shot that took it gets the weight and score.
		List<String> shots = new ArrayList<>(shots(player));
		for (int i = 0; i < shots.size(); i++) {
			JsonObject s = JsonParser.parseString(shots.get(i)).getAsJsonObject();
			if (s.get("id").getAsLong() == shotId) {
				s.addProperty("kg", kg);
				s.addProperty("score", score);
				shots.set(i, s.toString());
				player.setAttached(HuntingRegistry.SHOTS, shots);
				break;
			}
		}
	}

	public static List<String> shotNotes(ServerPlayer player, long shotId) {
		for (String json : shots(player)) {
			JsonObject s = JsonParser.parseString(json).getAsJsonObject();
			if (s.get("id").getAsLong() == shotId) {
				List<String> out = new ArrayList<>();
				s.getAsJsonArray("notes").forEach(n -> out.add(n.getAsString()));
				return out;
			}
		}
		return List.of();
	}

	/** Every 2 seconds: game within 16 blocks counts as seen. */
	public static void spot(ServerPlayer player) {
		List<String> seen = new ArrayList<>(player.getAttachedOrCreate(HuntingRegistry.SEEN));
		boolean changed = false;
		for (var mob : player.level().getEntitiesOfClass(net.minecraft.world.entity.Mob.class, player.getBoundingBox().inflate(16), m -> m instanceof dk.ulfen.hunting.entity.GameCreature)) {
			String id = net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getKey(mob.getType()).getPath();
			if (seen.contains(id)) continue;
			seen.add(id);
			changed = true;
			player.sendOverlayMessage(Component.translatable("hunting.journal.spotted", Component.translatable("entity.hunting." + id)));
			player.level().playSound(null, player.blockPosition(), net.minecraft.sounds.SoundEvents.EXPERIENCE_ORB_PICKUP, net.minecraft.sounds.SoundSource.PLAYERS, 0.6F, 1.4F);
		}
		if (changed) player.setAttached(HuntingRegistry.SEEN, seen);
	}

	/** Everyone gets a Hunting Journal the first time they join. */
	public static void onJoin(ServerPlayer player) {
		if (player.getAttachedOrCreate(HuntingRegistry.JOURNAL_GIVEN)) return;
		player.setAttached(HuntingRegistry.JOURNAL_GIVEN, true);
		player.getInventory().add(new ItemStack(HuntingRegistry.item("hunting_journal")));
		player.sendSystemMessage(Component.translatable("hunting.journal.welcome"));
	}

	/** Open the journal on the client with everything it needs. */
	public static void open(ServerPlayer player) {
		JsonObject o = new JsonObject();
		JsonArray shots = new JsonArray();
		shots(player).forEach(s -> shots.add(JsonParser.parseString(s)));
		JsonArray trophies = new JsonArray();
		trophies(player).forEach(s -> trophies.add(JsonParser.parseString(s)));
		o.add("shots", shots);
		o.add("trophies", trophies);
		o.add("seen", GSON.toJsonTree(player.getAttachedOrCreate(HuntingRegistry.SEEN)));
		Wind w = Wind.at(player.level().getGameTime());
		o.addProperty("windFrom", w.compass());
		o.addProperty("windSpeed", Math.round(w.speed() * 10) / 10.0);
		o.addProperty("windStrength", w.strength());
		HuntingNetwork.sendJournal(player, o.toString());
	}
}
