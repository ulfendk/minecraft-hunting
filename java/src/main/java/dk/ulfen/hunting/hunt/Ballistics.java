package dk.ulfen.hunting.hunt;

import net.minecraft.world.phys.Vec3;

/**
 * Exterior ballistics, the same formulas as scripts/lib/ballistics.js in the Bedrock pack.
 * Distances in blocks (= metres). Velocity decays exponentially with distance.
 */
public final class Ballistics {
	public static final double GRAVITY = 9.81;
	public static final double SIGHT_HEIGHT = 0.04;
	public static final double ZERO = 100;

	private Ballistics() {}

	public static double timeOfFlight(HuntingData.Calibre c, double s) {
		return c.drag() > 0 ? (Math.exp(c.drag() * s) - 1) / (c.drag() * c.velocity()) : s / c.velocity();
	}

	public static double energyAt(HuntingData.Calibre c, double s) {
		return c.energy() * Math.exp(-2 * c.drag() * s);
	}

	public static double dropAt(HuntingData.Calibre c, double s) {
		double t = timeOfFlight(c, s);
		return 0.5 * GRAVITY * t * t;
	}

	public static double zeroAngle(HuntingData.Calibre c) {
		return (dropAt(c, ZERO) + SIGHT_HEIGHT) / ZERO;
	}

	/** Height of the bullet relative to the line of sight at distance s (metres, negative = low). */
	public static double heightAt(HuntingData.Calibre c, double s) {
		return -SIGHT_HEIGHT + zeroAngle(c) * s - dropAt(c, s);
	}

	/** Bullet position at distance s along the aim, with a horizontal wind (m/s, blowing towards). */
	public static Vec3 pointAt(HuntingData.Calibre c, Vec3 eye, Vec3 dir, Wind wind, double s) {
		double h = Math.hypot(dir.x, dir.z);
		if (h == 0) h = 1;
		double hx = dir.x / h, hz = dir.z / h;
		double along = wind.x() * hx + wind.z() * hz;
		double cx = wind.x() - along * hx, cz = wind.z() - along * hz;
		double lag = timeOfFlight(c, s) - s / c.velocity();
		return new Vec3(eye.x + dir.x * s + cx * lag, eye.y + dir.y * s + heightAt(c, s), eye.z + dir.z * s + cz * lag);
	}
}
