package dk.ulfen.hunting.hunt;

/**
 * Wind at a world time: slowly turning and gusting, deterministic so both editions agree
 * (scripts/lib/ballistics.js windAt). x/z in m/s is the direction it blows towards;
 * `from` is the compass bearing it comes from (0 = north, 90 = east).
 */
public record Wind(double x, double z, double speed, double from) {
	public static final Wind CALM = new Wind(0, 0, 0, 0);
	private static final String[] COMPASS = {"n", "ne", "e", "se", "s", "sw", "w", "nw"};

	public static Wind at(long ticks) {
		double t = ticks;
		double angle = 0.8 + 1.4 * Math.sin(t / 9000) + 0.6 * Math.sin(t / 2300 + 1.3) + 0.25 * Math.sin(t / 410 + 0.4);
		double speed = 3.2 + 2.4 * Math.sin(t / 6100 + 0.4) + 1.1 * Math.sin(t / 1300 + 2.1) + 0.5 * Math.sin(t / 170);
		speed = Math.max(0, Math.min(10, speed));
		double x = Math.cos(angle) * speed, z = Math.sin(angle) * speed;
		double from = Math.toDegrees(Math.atan2(-x, z));
		from = ((from % 360) + 360) % 360;
		return new Wind(x, z, speed, from);
	}

	public String compass() {
		return COMPASS[(int) Math.round(from / 45) % 8];
	}

	public int strength() {
		if (speed < 0.5) return 0;
		if (speed < 2) return 1;
		if (speed < 4) return 2;
		if (speed < 6) return 3;
		if (speed < 8.5) return 4;
		return 5;
	}
}
