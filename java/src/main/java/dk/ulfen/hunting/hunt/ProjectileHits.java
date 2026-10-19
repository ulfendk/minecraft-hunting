package dk.ulfen.hunting.hunt;

import java.util.List;

import dk.ulfen.hunting.entity.GameAnimal;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.phys.Vec3;

/**
 * A projectile (broadhead arrow, harpoon bolt, thrown harpoon) hitting a game animal, evaluated
 * hit zone by hit zone. The Java twin of projectileHit() in scripts/shooting.js.
 */
public final class ProjectileHits {
	private ProjectileHits() {}

	/**
	 * `power` is 1 for a full-strength hit; harpoons through the air are weaker (it scales the
	 * penetration, and the energy with its square). Returns the report, already applied.
	 */
	public static HitZones.Report hit(GameAnimal animal, ServerLevel level, ServerPlayer player, String calibre, Vec3 at, Vec3 velocity, double power, int noise) {
		HuntingData.Calibre c = HuntingData.CALIBRES.get(calibre);
		Vec3 dir = velocity.lengthSqr() < 1e-6 ? animal.position().subtract(player.position()).normalize() : velocity.normalize();
		Vec3 start = at.subtract(dir.scale(3));
		HitZones.ModelSpace m = new HitZones.ModelSpace(animal.position(), animal.yBodyRot, animal.getScale());
		double energy = c.energy() * power * power;
		HitZones.Report r = HitZones.evaluate(Shooting.hitModelFor(animal), m.point(start), m.direction(dir), energy, c.penetration() * power,
			6.25 * animal.getScale(), 0, true);
		// The engine says it hit; the model says it slipped past: count it as a graze.
		if (!r.hit()) r = new HitZones.Report(true, List.of(new HitZones.ZoneHit("muscle", 10)), "wound", 0, r.accuracy(), "unethical",
			null, null, null, null, false, List.of());
		double distance = player.position().distanceTo(at);
		long id = Journal.recordShot(player, animal, r, distance, c.name(), energy, 0, 0);
		Wounds.applyHit(animal, level, r, player, id);
		Senses.makeNoise(player, noise, 20);
		return r;
	}
}
