package dk.ulfen.hunting.hunt;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * Where a shot hit an animal and what it did: the Java twin of scripts/lib/hitzones.js.
 * Works in the animal's model space (pixels, y up, facing -z, +x = its left).
 */
public final class HitZones {
	private static final double STEP = 0.25;

	private HitZones() {}

	/** A model cube or organ box: m takes model space into the box's own space. */
	public record Box(double[] m, double[] min, double[] max, String zone) {}

	public record Model(List<Box> cubes, List<Box> organs, Map<String, Double> zoneSize, double[] vital, double vitalRadius, double[] boundsMin, double[] boundsMax) {
		public static Model from(JsonObject j) {
			return new Model(boxes(j.getAsJsonArray("cubes")), boxes(j.getAsJsonArray("organs")), sizes(j.getAsJsonObject("zoneSize")),
				doubles(j.getAsJsonArray("vital")), j.get("vitalRadius").getAsDouble(),
				doubles(j.getAsJsonArray("bounds").get(0).getAsJsonArray()), doubles(j.getAsJsonArray("bounds").get(1).getAsJsonArray()));
		}

		private static List<Box> boxes(JsonArray a) {
			List<Box> out = new ArrayList<>();
			for (JsonElement e : a) {
				JsonArray b = e.getAsJsonArray();
				out.add(new Box(doubles(b.get(0).getAsJsonArray()), doubles(b.get(1).getAsJsonArray()), doubles(b.get(2).getAsJsonArray()), b.get(3).getAsString()));
			}
			return out;
		}

		private static Map<String, Double> sizes(JsonObject o) {
			Map<String, Double> out = new LinkedHashMap<>();
			for (var e : o.entrySet()) out.put(e.getKey(), e.getValue().getAsDouble());
			return out;
		}

		private static double[] doubles(JsonArray a) {
			double[] out = new double[a.size()];
			for (int i = 0; i < out.length; i++) out[i] = a.get(i).getAsDouble();
			return out;
		}
	}

	public record ZoneHit(String zone, int percent) {}

	/** The evaluation of one shot. entry/exit are model-space points (null if it missed / stayed inside). */
	public record Report(boolean hit, List<ZoneHit> zones, String fate, double bleedSeconds, int accuracy, String grade,
		double @Nullable [] entry, double @Nullable [] exit, @Nullable String entrySide, @Nullable String exitSide, boolean underpowered, List<String> notes) {
		public static Report miss(int accuracy) {
			return new Report(false, List.of(), "none", 0, accuracy, "miss", null, null, null, null, false, List.of());
		}

		public Report with(List<ZoneHit> zones, String fate, int accuracy) {
			return new Report(hit, zones, fate, bleedSeconds, accuracy, grade, entry, exit, entrySide, exitSide, underpowered, notes);
		}

		public boolean has(String zone) {
			return zones.stream().anyMatch(z -> z.zone().equals(zone));
		}

		/** The most important zone hit (drives the x-ray highlight and the blood). */
		public @Nullable String primaryZone() {
			String best = null;
			for (ZoneHit z : zones) if (best == null || HuntingData.rank(z.zone()) < HuntingData.rank(best)) best = z.zone();
			return best;
		}
	}

	static double[] apply(double[] m, double[] p) {
		return new double[] {
			m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
			m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
			m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
		};
	}

	static double[] rotate(double[] m, double[] d) {
		return new double[] {
			m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
			m[4] * d[0] + m[5] * d[1] + m[6] * d[2],
			m[8] * d[0] + m[9] * d[1] + m[10] * d[2],
		};
	}

	private static boolean inside(double[] q, double[] min, double[] max) {
		return q[0] >= min[0] && q[0] <= max[0] && q[1] >= min[1] && q[1] <= max[1] && q[2] >= min[2] && q[2] <= max[2];
	}

	private static double @Nullable [] slab(double[] o, double[] d, double[] min, double[] max) {
		double t0 = Double.NEGATIVE_INFINITY, t1 = Double.POSITIVE_INFINITY;
		for (int i = 0; i < 3; i++) {
			if (Math.abs(d[i]) < 1e-9) {
				if (o[i] < min[i] || o[i] > max[i]) return null;
				continue;
			}
			double a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
			if (a > b) { double t = a; a = b; b = t; }
			if (a > t0) t0 = a;
			if (b < t1) t1 = b;
			if (t0 > t1) return null;
		}
		if (t1 < 0) return null;
		return new double[] {Math.max(0, t0), t1};
	}

	/** First and last time a ray is inside the silhouette, or null. */
	public static double @Nullable [] intersect(Model model, double[] o, double[] d) {
		double tIn = Double.POSITIVE_INFINITY, tOut = Double.NEGATIVE_INFINITY;
		for (Box b : model.cubes()) {
			double[] hit = slab(apply(b.m(), o), rotate(b.m(), d), b.min(), b.max());
			if (hit == null) continue;
			tIn = Math.min(tIn, hit[0]);
			tOut = Math.max(tOut, hit[1]);
		}
		return tIn == Double.POSITIVE_INFINITY ? null : new double[] {tIn, tOut};
	}

	public static @Nullable String zoneAt(Model model, double[] p) {
		String best = null;
		int rank = Integer.MAX_VALUE;
		for (Box b : model.organs()) {
			int r = HuntingData.rank(b.zone());
			if (r < rank && inside(apply(b.m(), p), b.min(), b.max())) { best = b.zone(); rank = r; }
		}
		if (best != null) return best;
		for (Box b : model.cubes()) {
			int r = HuntingData.rank(b.zone());
			if (r < rank && inside(apply(b.m(), p), b.min(), b.max())) { best = b.zone(); rank = r; }
		}
		return best;
	}

	private record Segment(String zone, double[] px) {}

	private static double missDistance(double[] o, double[] d, double[] c) {
		double[] v = {c[0] - o[0], c[1] - o[1], c[2] - o[2]};
		double t = Math.max(0, v[0] * d[0] + v[1] * d[1] + v[2] * d[2]);
		return Math.sqrt(sq(v[0] - d[0] * t) + sq(v[1] - d[1] * t) + sq(v[2] - d[2] * t));
	}

	private static double sq(double v) {
		return v * v;
	}

	public static String sideOf(Model model, double[] p) {
		double[] rel = new double[3];
		for (int i = 0; i < 3; i++) {
			double mn = model.boundsMin()[i], mx = model.boundsMax()[i];
			rel[i] = (p[i] - (mn + mx) / 2) / Math.max(1, (mx - mn) / 2);
		}
		double ax = Math.abs(rel[0]), ay = Math.abs(rel[1]), az = Math.abs(rel[2]);
		if (ax >= ay && ax >= az) return rel[0] > 0 ? "left" : "right";
		if (az >= ay) return rel[2] < 0 ? "front" : "rear";
		return rel[1] > 0 ? "top" : "bottom";
	}

	private static int fateRank(String f) {
		return switch (f) {
			case "kill" -> 3;
			case "mortal" -> 2;
			case "wound" -> 1;
			default -> 0;
		};
	}

	/** Same rules as evaluate() in hitzones.js. */
	public static Report evaluate(Model model, double[] o, double[] d, double energy, double penetration, double cmPerPx, double minEnergy, boolean bigGame) {
		double dist = missDistance(o, d, model.vital());
		int accuracy = (int) Math.max(0, Math.min(100, Math.round(100 * (1 - dist / (2.5 * model.vitalRadius())))));
		double[] span = intersect(model, o, d);
		if (span == null) return Report.miss(accuracy);

		// Trace through the body.
		List<Segment> path = new ArrayList<>();
		double[] entry = null, last = null;
		double left = penetration;
		boolean stopped = false;
		for (double t = span[0]; t <= span[1] + STEP; t += STEP) {
			double[] p = {o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t};
			String zone = zoneAt(model, p);
			if (zone == null) continue;
			if (entry == null) entry = p;
			last = p;
			if (!path.isEmpty() && path.getLast().zone().equals(zone)) path.getLast().px()[0] += STEP;
			else path.add(new Segment(zone, new double[] {STEP}));
			HuntingData.Zone z = HuntingData.zone(zone);
			left -= STEP * cmPerPx * (z == null ? 1 : z.density());
			if (left <= 0) {
				stopped = true;
				break;
			}
		}
		if (entry == null) return Report.miss(accuracy);

		boolean underpowered = minEnergy > 0 && energy < minEnergy;
		List<String> notes = new ArrayList<>();
		Map<String, Double> totals = new LinkedHashMap<>();
		for (Segment s : path) totals.merge(s.zone(), s.px()[0], Double::sum);
		double power = minEnergy > 0 ? Math.min(1.2, Math.max(0.35, energy / minEnergy)) : 1;
		List<ZoneHit> hits = new ArrayList<>();
		for (var e : totals.entrySet()) {
			double size = Math.max(1, model.zoneSize().getOrDefault(e.getKey(), 4.0));
			hits.add(new ZoneHit(e.getKey(), (int) Math.max(5, Math.min(100, Math.round(100 * power * e.getValue() / size)))));
		}

		String fate = "none";
		double bleed = Double.POSITIVE_INFINITY;
		for (ZoneHit h : hits) {
			HuntingData.Zone z = HuntingData.zone(h.zone());
			String f = z.fate();
			double b = z.bleedSeconds();
			if (underpowered && f.equals("kill")) { f = "mortal"; b = 6; }
			if (f.equals("mortal")) b *= underpowered ? 2 : 1;
			if (fateRank(f) > fateRank(fate)) fate = f;
			if (f.equals("mortal")) bleed = Math.min(bleed, b);
		}
		double lungs = totals.getOrDefault("lungs", 0.0);
		if (lungs > model.zoneSize().getOrDefault("lungs", 8.0) * 0.8) bleed = Math.min(bleed, 4);

		String grade;
		// Gills are a fish's lungs.
		boolean breath = totals.containsKey("lungs") || totals.containsKey("gills");
		if (totals.containsKey("heart") || (breath && accuracy >= 75)) grade = "perfect";
		else if (breath || totals.containsKey("brain") || totals.containsKey("spine")) grade = "good";
		else if (totals.containsKey("liver")) grade = "poor";
		else if (fate.equals("none")) grade = "miss";
		else grade = "unethical";
		if (underpowered && !grade.equals("miss")) {
			grade = switch (grade) {
				case "perfect" -> "good";
				case "good" -> "poor";
				default -> "unethical";
			};
			notes.add("underpowered");
		}
		if (!bigGame && minEnergy > 0 && energy > minEnergy * 6) notes.add("meat_damage");
		if (stopped) notes.add("no_exit");
		double[] exit = stopped ? null : last;
		return new Report(true, hits, fate, fate.equals("mortal") ? bleed : 0, accuracy, grade, round(entry), exit == null ? null : round(exit),
			sideOf(model, entry), exit == null ? null : sideOf(model, exit), underpowered, notes);
	}

	private static double[] round(double[] p) {
		return new double[] {Math.round(p[0] * 10) / 10.0, Math.round(p[1] * 10) / 10.0, Math.round(p[2] * 10) / 10.0};
	}

	/** World -> model space for an entity at `pos` with body yaw (degrees) and render scale. */
	public record ModelSpace(Vec3 pos, double yaw, double scale) {
		public double[] point(Vec3 p) {
			double k = 16 / scale;
			return dir(new Vec3((p.x - pos.x) * k, (p.y - pos.y) * k, (p.z - pos.z) * k), false);
		}

		public double[] direction(Vec3 v) {
			return dir(v, true);
		}

		private double[] dir(Vec3 v, boolean normalise) {
			double r = Math.toRadians(yaw);
			double fx = -Math.sin(r), fz = Math.cos(r);
			double rx = -Math.cos(r), rz = -Math.sin(r);
			double[] d = {-(v.x * rx + v.z * rz), v.y, -(v.x * fx + v.z * fz)};
			if (!normalise) return d;
			double n = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
			if (n == 0) n = 1;
			return new double[] {d[0] / n, d[1] / n, d[2] / n};
		}

		/** Model space -> world (for tests and effects). */
		public Vec3 world(double[] p) {
			double k = scale / 16;
			double r = Math.toRadians(yaw);
			double fx = -Math.sin(r), fz = Math.cos(r);
			double rx = -Math.cos(r), rz = -Math.sin(r);
			return new Vec3(pos.x - p[0] * k * rx - p[2] * k * fx, pos.y + p[1] * k, pos.z - p[0] * k * rz - p[2] * k * fz);
		}
	}
}
