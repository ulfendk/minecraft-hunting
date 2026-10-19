package dk.ulfen.hunting.test;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameAnimal;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.hunt.Ballistics;
import dk.ulfen.hunting.hunt.HitZones;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Shooting;
import dk.ulfen.hunting.hunt.Wind;
import dk.ulfen.hunting.hunt.Wounds;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.BlockPos;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import dk.ulfen.hunting.entity.GameFish;
import dk.ulfen.hunting.entity.MiniSubmarine;
import dk.ulfen.hunting.hunt.Diving;
import dk.ulfen.hunting.hunt.ProjectileHits;
import dk.ulfen.hunting.hunt.Tether;

/** Server-side checks run by `./gradlew runGameTest` (and in CI). */
public class HuntingGameTests {
	private static RuntimeException fail(GameTestHelper helper, String message) {
		return helper.assertionException(Component.literal(message));
	}

	private static JsonObject vectors() {
		try (var in = HuntingGameTests.class.getResourceAsStream("/data/hunting/test_vectors.json")) {
			return JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
		} catch (java.io.IOException e) {
			throw new IllegalStateException(e);
		}
	}

	/** Every species can be spawned and is still alive two seconds later. */
	@GameTest(maxTicks = 100)
	public void everyAnimalSpawns(GameTestHelper helper) {
		List<Mob> mobs = new ArrayList<>();
		int i = 0;
		for (EntityType<? extends Mob> type : HuntingRegistry.ANIMALS.values()) {
			BlockPos pos = new BlockPos(1 + (i % 6), 1, 1 + (i / 6));
			// Fish get a little water to swim in.
			if (SpeciesRegistry.of(type).isSwimmer()) helper.setBlock(pos, Blocks.WATER);
			Mob mob = helper.spawn(type, pos);
			mob.addEffect(new MobEffectInstance(MobEffects.RESISTANCE, 200, 4));
			mobs.add(mob);
			i++;
		}
		helper.runAfterDelay(40, () -> {
			for (Mob m : mobs) if (!m.isAlive()) throw fail(helper, "Died or vanished: " + m.getType().getDescriptionId());
			helper.succeed();
		});
	}

	/** The Java hit zones, ballistics and wind give exactly what the Bedrock scripts (JavaScript) give. */
	@GameTest
	public void matchesJavaScript(GameTestHelper helper) {
		JsonObject v = vectors();
		int checked = 0;
		for (JsonElement e : v.getAsJsonArray("shots")) {
			JsonObject s = e.getAsJsonObject();
			Species sp = SpeciesRegistry.get(s.get("species").getAsString());
			HuntingData.Calibre c = HuntingData.CALIBRES.get(s.get("calibre").getAsString());
			double[] o = doubles(s.getAsJsonArray("o")), d = doubles(s.getAsJsonArray("d"));
			double minEnergy = c.isShot() ? sp.game().minShotEnergy() : sp.game().minEnergy();
			HitZones.Report r = HitZones.evaluate(sp.model(), o, d, c.energy(), c.penetration(), 6.25 * sp.scale(), minEnergy, !sp.game().gameClass().equals("small"));
			List<String> zones = r.zones().stream().map(z -> z.zone() + ":" + z.percent()).toList();
			List<String> expected = new ArrayList<>();
			s.getAsJsonArray("zones").forEach(z -> expected.add(z.getAsString()));
			String where = sp.id() + " " + s.get("calibre").getAsString() + " from " + s.getAsJsonArray("o");
			if (r.hit() != s.get("hit").getAsBoolean()) throw fail(helper, where + ": hit " + r.hit());
			if (!zones.equals(expected)) throw fail(helper, where + ": zones " + zones + " != " + expected);
			if (!r.fate().equals(s.get("fate").getAsString())) throw fail(helper, where + ": fate " + r.fate());
			if (!r.grade().equals(s.get("grade").getAsString())) throw fail(helper, where + ": grade " + r.grade());
			if (r.accuracy() != s.get("accuracy").getAsInt()) throw fail(helper, where + ": accuracy " + r.accuracy());
			checked++;
		}
		for (JsonElement e : v.getAsJsonArray("ballistics")) {
			JsonObject b = e.getAsJsonObject();
			HuntingData.Calibre c = HuntingData.CALIBRES.get(b.get("calibre").getAsString());
			double s = b.get("s").getAsDouble();
			Vec3 p = Ballistics.pointAt(c, new Vec3(0, 64, 0), new Vec3(0.6, 0.1, 0.7937), new Wind(3, -2, 0, 0), s);
			if (Math.abs(p.x - b.get("x").getAsDouble()) > 1e-9 || Math.abs(p.y - b.get("y").getAsDouble()) > 1e-9 || Math.abs(p.z - b.get("z").getAsDouble()) > 1e-9) {
				throw fail(helper, "ballistics " + b + " got " + p);
			}
			if (Math.abs(Ballistics.energyAt(c, s) - b.get("energy").getAsDouble()) > 1e-6) throw fail(helper, "energy " + b);
		}
		for (JsonElement e : v.getAsJsonArray("wind")) {
			JsonObject w = e.getAsJsonObject();
			Wind got = Wind.at(w.get("t").getAsLong());
			if (Math.abs(got.x() - w.get("x").getAsDouble()) > 1e-9 || Math.abs(got.from() - w.get("from").getAsDouble()) > 1e-9) throw fail(helper, "wind " + w);
		}
		if (checked < 50) throw fail(helper, "too few shot vectors: " + checked);
		helper.succeed();
	}

	private static double[] doubles(JsonArray a) {
		double[] out = new double[a.size()];
		for (int i = 0; i < out.length; i++) out[i] = a.get(i).getAsDouble();
		return out;
	}

	private static double[] organCentre(HitZones.Model m, String zone) {
		for (HitZones.Box b : m.organs()) {
			if (!b.zone().equals(zone)) continue;
			double[] q = {(b.min()[0] + b.max()[0]) / 2, (b.min()[1] + b.max()[1]) / 2, (b.min()[2] + b.max()[2]) / 2};
			double[] mm = b.m();
			double[] t = {mm[3], mm[7], mm[11]};
			double[] v = {q[0] - t[0], q[1] - t[1], q[2] - t[2]};
			return new double[] {mm[0] * v[0] + mm[4] * v[1] + mm[8] * v[2], mm[1] * v[0] + mm[5] * v[1] + mm[9] * v[2], mm[2] * v[0] + mm[6] * v[1] + mm[10] * v[2]};
		}
		throw new IllegalArgumentException(zone);
	}

	/** A real traced .308 shot from 3 blocks to a deer's left goes through the heart, and a kill leaves a carcass. */
	@GameTest(maxTicks = 60)
	public void heartShotDropsDeer(GameTestHelper helper) {
		GameAnimal deer = (GameAnimal) helper.spawn(HuntingRegistry.ANIMALS.get("white_tailed_deer"), new BlockPos(4, 1, 4));
		deer.setNoAi(true);
		deer.setAge(0);
		helper.runAfterDelay(5, () -> {
			HitZones.ModelSpace m = new HitZones.ModelSpace(deer.position(), deer.yBodyRot, deer.getScale());
			double[] heart = organCentre(Shooting.hitModelFor(deer), "heart");
			Vec3 target = m.world(heart);
			Vec3 from = m.world(new double[] {heart[0] + 16 * 3, heart[1], heart[2]});
			Shooting.Hit hit = Shooting.trace(helper.getLevel(), from, target.subtract(from).normalize(), HuntingData.CALIBRES.get("c308"), Wind.CALM, null);
			if (!hit.kind().equals("game") || hit.entity() != deer) throw fail(helper, "traced shot did not hit the deer: " + hit.kind());
			if (!hit.report().has("heart")) throw fail(helper, "traced shot zones: " + hit.report().zones());
			Wounds.becomeCarcass(deer, helper.getLevel(), null, 1);
			if (deer.huntState() != GameCreature.CARCASS) throw fail(helper, "deer is not a carcass");
			helper.succeed();
		});
	}

	/** A sprinting hunter in plain sight is noticed far more than one crouching still. */
	@GameTest
	public void sprintingIsNoticed(GameTestHelper helper) {
		GameAnimal deer = (GameAnimal) helper.spawn(HuntingRegistry.ANIMALS.get("white_tailed_deer"), new BlockPos(1, 1, 1));
		deer.setNoAi(true);
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		Vec3 eye = deer.getEyePosition();
		// 20 blocks: beyond the range at which it would smell a hunter in still air.
		Vec3 ahead = eye.add(deer.getViewVector(1.0F).scale(20));
		player.snapTo(ahead.x, deer.getY(), ahead.z, 0, 0);
		Species.Senses s = deer.species().senses();
		Wind calm = Wind.CALM;
		player.setSprinting(true);
		player.setDeltaMovement(0.3, 0, 0);
		double sprint = Senses.sense(helper.getLevel(), deer, s, player, calm);
		player.setSprinting(false);
		player.setShiftKeyDown(true);
		player.setDeltaMovement(Vec3.ZERO);
		double still = Senses.sense(helper.getLevel(), deer, s, player, calm);
		if (!(sprint > still * 3 && sprint > Senses.ALERT / 3)) throw fail(helper, "sprint " + sprint + " vs crouching " + still);
		helper.succeed();
	}

	/** A leg wound makes the animal wounded, flee and bleed. */
	@GameTest(maxTicks = 100)
	public void woundedAnimalBleeds(GameTestHelper helper) {
		GameAnimal deer = (GameAnimal) helper.spawn(HuntingRegistry.ANIMALS.get("white_tailed_deer"), new BlockPos(4, 1, 4));
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		HitZones.Report r = new HitZones.Report(true, List.of(new HitZones.ZoneHit("liver", 60)), "mortal", 2, 40, "poor", null, null, "left", "right", false, List.of());
		Wounds.applyHit(deer, helper.getLevel(), r, player, 7);
		if (deer.huntState() != GameCreature.WOUNDED) throw fail(helper, "not wounded: " + deer.huntState());
		helper.succeedWhen(() -> {
			if (!deer.isCarcass()) throw fail(helper, "has not bled out yet");
			if (Wounds.trailsNear(helper.getLevel(), deer.position(), 30).isEmpty()) throw fail(helper, "no blood trail");
		});
	}

	// ---------------------------------------------------------------- spearfishing

	/** Fill a box (relative coordinates, inclusive) with water, walled in with glass so it can't spill out. */
	private static void pool(GameTestHelper helper, int x0, int y0, int z0, int x1, int y1, int z1) {
		for (int x = x0 - 1; x <= x1 + 1; x++) for (int y = y0; y <= y1; y++) for (int z = z0 - 1; z <= z1 + 1; z++) {
			boolean inside = x >= x0 && x <= x1 && z >= z0 && z <= z1;
			helper.setBlock(new BlockPos(x, y, z), inside ? Blocks.WATER : Blocks.GLASS);
		}
	}

	/** A sea bass in a pool swims about and is still in the water (and alive) three seconds later. */
	@GameTest(maxTicks = 100)
	public void fishStaysInWater(GameTestHelper helper) {
		pool(helper, 1, 1, 1, 6, 5, 6);
		GameFish fish = (GameFish) helper.spawn(HuntingRegistry.ANIMALS.get("sea_bass"), new BlockPos(3, 2, 3));
		helper.runAfterDelay(60, () -> {
			if (!fish.isAlive() || fish.isCarcass()) throw fail(helper, "the fish died");
			if (!fish.isInWater()) throw fail(helper, "the fish left the water");
			helper.succeed();
		});
	}

	/** A harpoon bolt through a fish's heart, under water, is lethal; through the air it does less. */
	@GameTest(maxTicks = 40)
	public void harpoonHitsFish(GameTestHelper helper) {
		pool(helper, 1, 1, 1, 6, 4, 6);
		GameFish fish = (GameFish) helper.spawn(HuntingRegistry.ANIMALS.get("bluefin_tuna"), new BlockPos(3, 2, 3));
		fish.setNoAi(true);
		fish.setAge(0);
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		helper.runAfterDelay(2, () -> {
			HitZones.ModelSpace m = new HitZones.ModelSpace(fish.position(), fish.yBodyRot, fish.getScale());
			double[] heart = organCentre(Shooting.hitModelFor(fish), "heart");
			Vec3 at = m.world(new double[] {heart[0] + 6, heart[1], heart[2]});
			Vec3 dir = m.world(heart).subtract(at).normalize();
			HitZones.Report wet = ProjectileHits.hit(fish, helper.getLevel(), player, "harpoon_bolt", at, dir, 1.0, 6);
			if (!wet.has("heart") || !(wet.fate().equals("mortal") || wet.fate().equals("kill"))) throw fail(helper, "heart shot: " + wet.fate() + " " + wet.zones());
			helper.succeed();
		});
	}

	/** A fish on the line comes back with its bolt when it is let go, and a dive knife field dresses it. */
	@GameTest(maxTicks = 40)
	public void lineAndDiveKnife(GameTestHelper helper) {
		pool(helper, 1, 1, 1, 6, 4, 6);
		GameFish fish = (GameFish) helper.spawn(HuntingRegistry.ANIMALS.get("sea_bass"), new BlockPos(3, 2, 3));
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		player.snapTo(helper.absoluteVec(new Vec3(4, 2, 4)));
		if (!Tether.attach(player, fish, new ItemStack(HuntingRegistry.item("harpoon_bolt")), false, 20)) throw fail(helper, "could not attach the line");
		if (!fish.isLeashed() || Tether.held(player) == null) throw fail(helper, "the fish is not on the line");
		if (!Tether.release(player)) throw fail(helper, "could not let go of the line");
		if (fish.isLeashed()) throw fail(helper, "still leashed after letting go");
		if (!player.getInventory().contains(new ItemStack(HuntingRegistry.item("harpoon_bolt")))) throw fail(helper, "the bolt did not come back");
		Wounds.becomeCarcass(fish, helper.getLevel(), player.getUUID(), 0);
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(HuntingRegistry.item("dive_knife")));
		Wounds.fieldDress(fish, helper.getLevel(), player, player.getMainHandItem());
		if (!fish.isRemoved()) throw fail(helper, "the dive knife did not field dress the fish");
		helper.succeed();
	}

	/** With a dive mask and a scuba tank a diver keeps breathing, and the tank empties. */
	@GameTest(maxTicks = 40)
	public void scubaKeepsAirAndDrainsTank(GameTestHelper helper) {
		pool(helper, 1, 1, 1, 3, 4, 3);
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		player.setGameMode(net.minecraft.world.level.GameType.SURVIVAL);
		player.snapTo(helper.absoluteVec(new Vec3(2.5, 1, 2.5)));
		player.setItemSlot(EquipmentSlot.HEAD, new ItemStack(HuntingRegistry.item("dive_mask")));
		ItemStack tank = new ItemStack(HuntingRegistry.item("scuba_tank"));
		player.setItemSlot(EquipmentSlot.CHEST, tank);
		player.setAirSupply(10);
		helper.runAfterDelay(2, () -> {
			player.baseTick(); // the mock player isn't ticked by a client: work out the water it is in
			if (!player.isEyeInFluid(net.minecraft.tags.FluidTags.WATER)) throw fail(helper, "the test diver is not under water");
			Diving.tickPlayer(player);
			if (player.getAirSupply() != player.getMaxAirSupply()) throw fail(helper, "air not topped up: " + player.getAirSupply());
			ItemStack worn = player.getItemBySlot(EquipmentSlot.CHEST);
			if (Diving.air(worn) != Diving.maxAir() - Diving.STEP) throw fail(helper, "tank air " + Diving.air(worn));
			helper.succeed();
		});
	}

	/** A submarine with a flat battery floats up to the surface. */
	@GameTest(maxTicks = 100)
	public void flatSubmarineFloatsUp(GameTestHelper helper) {
		pool(helper, 1, 1, 1, 5, 7, 5);
		MiniSubmarine sub = helper.spawn(HuntingRegistry.MINI_SUBMARINE, new BlockPos(3, 1, 3));
		sub.setBattery(0);
		double y0 = sub.getY();
		helper.runAfterDelay(60, () -> {
			if (sub.getY() < y0 + 1) throw fail(helper, "did not rise: " + y0 + " -> " + sub.getY());
			helper.succeed();
		});
	}

	/** Redstone charges a submarine; players hitting it break it into its item. */
	@GameTest(maxTicks = 40)
	public void submarineChargesAndBreaks(GameTestHelper helper) {
		MiniSubmarine sub = helper.spawn(HuntingRegistry.MINI_SUBMARINE, new BlockPos(3, 1, 3));
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		player.setGameMode(net.minecraft.world.level.GameType.SURVIVAL);
		sub.setBattery(100);
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.REDSTONE, 2));
		sub.interact(player, InteractionHand.MAIN_HAND, sub.position());
		if (sub.battery() <= 100) throw fail(helper, "redstone did not charge the battery");
		if (player.getMainHandItem().getCount() != 1) throw fail(helper, "the redstone was not used up");
		for (int i = 0; i < 20 && !sub.isRemoved(); i++) sub.hurtServer(helper.getLevel(), helper.getLevel().damageSources().playerAttack(player), 4);
		if (!sub.isRemoved()) throw fail(helper, "the submarine did not break");
		AABB around = new AABB(sub.position(), sub.position()).inflate(3);
		boolean dropped = helper.getLevel().getEntitiesOfClass(ItemEntity.class, around, e -> e.getItem().is(HuntingRegistry.item("mini_submarine"))).size() == 1;
		if (!dropped) throw fail(helper, "the submarine item was not dropped");
		helper.succeed();
	}
}
