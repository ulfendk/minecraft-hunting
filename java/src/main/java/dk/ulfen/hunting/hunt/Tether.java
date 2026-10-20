package dk.ulfen.hunting.hunt;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import dk.ulfen.hunting.entity.GameCreature;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Leashable;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * The line on a speared fish (the Java twin of the line in scripts/harpoon.js). The harpoon
 * stays in the animal, which is leashed to the player: hold sneak to reel it in (a submarine's
 * winch does it for its pilot), use the speargun or harpoon to let go. A live fish fights in
 * bursts; held beyond the line's length for too long, the line snaps.
 */
public final class Tether {
	/** One line. `item` comes back when the fish is landed or let go. */
	public static final class Line {
		public final Mob target;
		public final UUID player;
		public final ItemStack item;
		public boolean winch;
		public final double length;
		public boolean winchOn;
		int taut;
		long fightAt;

		Line(Mob target, UUID player, ItemStack item, boolean winch, double length) {
			this.target = target;
			this.player = player;
			this.item = item;
			this.winch = winch;
			this.length = length;
		}

		public String tension(double distance) {
			return distance > length ? "breaking" : distance > length * 0.8 ? "tight" : "slack";
		}
	}

	private static final Map<UUID, Line> LINES = new LinkedHashMap<>();

	private Tether() {}

	public static @Nullable Line of(Mob target) {
		return LINES.get(target.getUUID());
	}

	public static @Nullable Line held(ServerPlayer player) {
		for (Line l : LINES.values()) if (l.player.equals(player.getUUID())) return l;
		return null;
	}

	/** The harpoon is in `target`: put it on the line. Returns false if it can't be held on one. */
	public static boolean attach(ServerPlayer player, Mob target, ItemStack item, boolean winch, double length) {
		if (!target.canBeLeashed() && !target.isLeashed() || LINES.containsKey(target.getUUID())) return false;
		Line old = held(player);
		if (old != null) end(old, player, "released");
		LINES.put(target.getUUID(), new Line(target, player.getUUID(), item, winch, length));
		target.setLeashedTo(player, true);
		HuntTarget a = HuntTarget.of(target);
		if (a != null && !a.isCarcass()) {
			player.sendOverlayMessage(Component.translatable("hunting.line.hooked", a.name()));
		}
		player.level().playSound(null, target.blockPosition(), SoundEvents.ARROW_HIT, SoundSource.PLAYERS, 1.0F, 0.7F);
		return true;
	}

	/** Using the speargun or harpoon with a fish on the line lets go of it. */
	public static boolean release(ServerPlayer player) {
		Line l = held(player);
		if (l == null || l.winch) return false;
		end(l, player, "released");
		return true;
	}

	/** The submarine switches its winch on and off (it needs battery to spare). */
	public static @Nullable Line setWinch(ServerPlayer player, boolean on) {
		Line l = held(player);
		if (l != null && l.winch) l.winchOn = on;
		return l;
	}

	private static void give(ServerPlayer player, ItemStack item) {
		if (item.isEmpty()) return;
		ItemStack copy = item.copy();
		if (!player.getInventory().add(copy)) player.spawnAtLocation(player.level(), copy);
	}

	private static void end(Line l, @Nullable ServerPlayer player, String how) {
		LINES.remove(l.target.getUUID());
		if (l.target.isLeashed()) l.target.removeLeash();
		if (how.equals("snapped")) {
			// A thrown harpoon falls out where the line broke; a bolt is lost.
			if (l.target.level() instanceof ServerLevel level && l.item.getMaxDamage() > 0) l.target.spawnAtLocation(level, l.item.copy());
			if (player != null) {
				player.sendOverlayMessage(Component.translatable("hunting.line.snapped"));
				player.level().playSound(null, player.blockPosition(), SoundEvents.ITEM_BREAK.value(), SoundSource.PLAYERS, 0.8F, 1.4F);
			}
			return;
		}
		if (player == null) return;
		give(player, l.item);
		HuntTarget landed = HuntTarget.of(l.target);
		if (how.equals("landed") && landed != null) {
			player.sendOverlayMessage(Component.translatable("hunting.line.landed", landed.name()));
		} else if (how.equals("released")) {
			player.sendOverlayMessage(Component.translatable("hunting.line.released"));
		}
	}

	/** GameAnimal hands its leash over here instead of dropping a lead. */
	public static void leashBroken(Mob target) {
		Line l = LINES.get(target.getUUID());
		if (l == null) return;
		ServerPlayer p = target.level().getServer() == null ? null : target.level().getServer().getPlayerList().getPlayer(l.player);
		// Let go by the player (right next to it), or pulled apart.
		end(l, p, p != null && p.distanceTo(target) < l.length ? "released" : "snapped");
	}

	public static double snapDistance(Line l) {
		return l.length * 1.5 + 1;
	}

	/** Every server tick. */
	public static void tick(MinecraftServer server) {
		if (LINES.isEmpty()) return;
		HuntingData.Line cfg = HuntingData.LINE;
		Iterator<Line> it = LINES.values().iterator();
		java.util.List<Object[]> ending = new java.util.ArrayList<>();
		while (it.hasNext()) {
			Line l = it.next();
			ServerPlayer player = server.getPlayerList().getPlayer(l.player);
			Mob target = l.target;
			if (player == null || target.isRemoved() || !target.isAlive() || player.level() != target.level()) {
				ending.add(new Object[] {l, player, player == null ? "lost" : "released"});
				continue;
			}
			if (!target.isLeashed()) {
				ending.add(new Object[] {l, player, "released"});
				continue;
			}
			// Out of the submarine its winch line becomes a hand line.
			if (l.winch && !(player.getVehicle() instanceof dk.ulfen.hunting.entity.MiniSubmarine)) {
				l.winch = false;
				l.winchOn = false;
			}
			ServerLevel level = player.level();
			Vec3 head = player.getEyePosition();
			Vec3 toPlayer = head.subtract(target.position()).normalize();
			double d = head.distanceTo(target.position());
			HuntTarget game = HuntTarget.of(target);
			boolean dead = game == null || game.isCarcass();
			double kg = game != null ? game.weightKg() : 5;

			if (dead && d <= cfg.landed()) {
				ending.add(new Object[] {l, player, "landed"});
				continue;
			}
			long now = level.getGameTime();
			if (!dead && now >= l.fightAt) {
				// A live fish fights in bursts: harder the bigger it is, less once badly wounded.
				l.fightAt = now + 6 + level.getRandom().nextInt(10);
				double strength = Math.max(0.4, Math.min(1.6, kg / 60)) * (game.huntState() == GameCreature.WOUNDED ? 0.6 : 1);
				Vec3 away = toPlayer.scale(-1).add(level.getRandom().nextDouble() - 0.5, (level.getRandom().nextDouble() - 0.5) * 0.4, level.getRandom().nextDouble() - 0.5).normalize();
				target.addDeltaMovement(away.scale(cfg.fight() * strength));
				target.needsSync = true;
			}
			boolean reeling = l.winch ? l.winchOn : player.isShiftKeyDown();
			if (reeling && d > cfg.landed()) {
				double pull = Math.max(0.03, cfg.pull() * (l.winch ? 1.5 : 1) / Math.max(1, Math.sqrt(kg / 10)));
				target.addDeltaMovement(toPlayer.scale(pull));
				target.needsSync = true;
			}
			if (d > snapDistance(l)) {
				ending.add(new Object[] {l, player, "snapped"});
				continue;
			}
			l.taut = d > l.length ? l.taut + 1 : Math.max(0, l.taut - 2);
			if (l.taut > cfg.snapTicks()) {
				ending.add(new Object[] {l, player, "snapped"});
				continue;
			}
			if (!l.winch && now % 5 == 0) {
				player.sendOverlayMessage(Component.translatable("hunting.line.status", String.valueOf(Math.round(d)), String.valueOf(Math.round(l.length)),
					Component.translatable("hunting.line." + l.tension(d))));
			}
		}
		for (Object[] e : ending) {
			Line l = (Line) e[0];
			String how = (String) e[2];
			if (how.equals("lost")) {
				LINES.remove(l.target.getUUID());
				if (l.target.isLeashed()) l.target.removeLeash();
			} else {
				end(l, (ServerPlayer) e[1], how);
			}
		}
	}

	/** Lines live in memory: forget them when the server stops (single player switches worlds). */
	public static void clear() {
		LINES.clear();
	}

	/** For the leash rules in GameAnimal. */
	public static boolean isTethered(Leashable target) {
		return target instanceof Mob m && LINES.containsKey(m.getUUID());
	}
}
