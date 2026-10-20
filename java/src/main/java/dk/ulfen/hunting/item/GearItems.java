package dk.ulfen.hunting.item;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.hunt.HuntTarget;
import dk.ulfen.hunting.hunt.Dogs;
import dk.ulfen.hunting.hunt.Journal;
import dk.ulfen.hunting.hunt.Senses;
import dk.ulfen.hunting.hunt.Wind;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

/** Binoculars, wind checker, calls, scent eliminator, dog whistle and the Hunting Journal. */
public final class GearItems {
	private GearItems() {}

	public static Component windText(Wind w) {
		return Component.translatable("hunting.wind.reading", Component.translatable("hunting.wind." + w.compass()),
			String.format(java.util.Locale.ROOT, "%.1f", w.speed()), Component.translatable("hunting.wind.strength." + w.strength()));
	}

	/** Binoculars: hold to look (the client zooms in); the server reports what you're looking at. */
	public static class Binoculars extends Item {
		public Binoculars(Properties p) {
			super(p);
		}

		@Override
		public ItemUseAnimation getUseAnimation(ItemStack stack) {
			return ItemUseAnimation.SPYGLASS;
		}

		@Override
		public int getUseDuration(ItemStack stack, LivingEntity user) {
			return 72000;
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			player.startUsingItem(hand);
			player.playSound(SoundEvents.SPYGLASS_USE, 1.0F, 1.0F);
			return InteractionResult.CONSUME;
		}

		@Override
		public void onUseTick(Level level, LivingEntity user, ItemStack stack, int remaining) {
			if (!(user instanceof ServerPlayer player) || remaining % 4 != 0) return;
			Vec3 eye = player.getEyePosition();
			Vec3 end = eye.add(player.getViewVector(1.0F).scale(256));
			HuntTarget best = null;
			double bestD = Double.MAX_VALUE;
			for (HuntTarget g : HuntTarget.in(player.level(), new net.minecraft.world.phys.AABB(eye, end).inflate(2), a -> true)) {
				var hit = g.mob().getBoundingBox().inflate(0.3).clip(eye, end);
				if (hit.isPresent() && hit.get().distanceTo(eye) < bestD) {
					best = g;
					bestD = hit.get().distanceTo(eye);
				}
			}
			if (best != null) {
				Component name = best.name();
				if (best.species().game() != null && best.species().game().maleTrophy() && !best.mob().isBaby()) {
					name = name.copy().append(" (").append(Component.translatable(best.isMale() ? "hunting.hud.buck" : "hunting.hud.doe")).append(")");
				}
				player.sendOverlayMessage(Component.translatable("hunting.hud.binoculars", name, String.valueOf(Math.round(bestD)),
					Component.translatable("hunting.hud.state." + best.huntState())));
			} else {
				var block = player.level().clip(new net.minecraft.world.level.ClipContext(eye, eye.add(player.getViewVector(1.0F).scale(320)),
					net.minecraft.world.level.ClipContext.Block.COLLIDER, net.minecraft.world.level.ClipContext.Fluid.ANY, player));
				if (block.getType() != net.minecraft.world.phys.HitResult.Type.MISS) {
					player.sendOverlayMessage(Component.translatable("hunting.hud.binoculars.none", String.valueOf(Math.round(block.getLocation().distanceTo(eye)))));
				}
			}
		}

		@Override
		public boolean releaseUsing(ItemStack stack, Level level, LivingEntity entity, int remainingTime) {
			entity.playSound(SoundEvents.SPYGLASS_STOP_USING, 1.0F, 1.0F);
			return false;
		}
	}

	/** Puffs of powder drift downwind; the action bar reads out the wind. */
	public static class WindChecker extends Item {
		public WindChecker(Properties p) {
			super(p);
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			if (level instanceof ServerLevel server && player instanceof ServerPlayer sp) {
				Wind w = Wind.at(level.getGameTime());
				Vec3 at = player.getEyePosition().add(player.getViewVector(1.0F).scale(0.8)).add(0, -0.2, 0);
				double speed = Math.max(0.02, w.speed() / 40);
				double nx = w.speed() > 0.1 ? w.x() / w.speed() : 0, nz = w.speed() > 0.1 ? w.z() / w.speed() : 0;
				for (int i = 0; i < 12; i++) {
					server.sendParticles(sp, ParticleTypes.WHITE_SMOKE, true, false, at.x, at.y, at.z, 0, nx, 0.05, nz, speed * (0.8 + 0.4 * i / 12.0));
				}
				sp.sendOverlayMessage(windText(w));
				player.getItemInHand(hand).hurtAndBreak(1, player, hand == InteractionHand.MAIN_HAND ? EquipmentSlot.MAINHAND : EquipmentSlot.OFFHAND);
			}
			player.playSound(SoundEvents.BOTTLE_EMPTY, 0.4F, 0.6F);
			return InteractionResult.SUCCESS;
		}
	}

	/** A game call: the species that answer to it walk towards you for a while. */
	public static class Call extends Item {
		private final String kind;
		private final SoundEvent sound;
		private final float pitch;

		public Call(String kind, SoundEvent sound, float pitch, Properties p) {
			super(p);
			this.kind = kind;
			this.sound = sound;
			this.pitch = pitch;
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			level.playSound(null, player.blockPosition(), this.sound, SoundSource.PLAYERS, 4.0F, this.pitch);
			if (level instanceof ServerLevel server) {
				Senses.makeNoise(player, 6, 20);
				for (HuntTarget g : HuntTarget.in(server, player.getBoundingBox().inflate(72), a -> !a.isCarcass())) {
					if (g.species().game() == null || !this.kind.equals(g.species().game().call()) || g.huntState() != GameCreature.CALM) continue;
					g.hunt().lure = player.position();
					g.hunt().lureUntil = level.getGameTime() + 20 * 25;
				}
				player.sendOverlayMessage(Component.translatable("hunting.call.used", Component.translatable(this.getDescriptionId())));
				player.getCooldowns().addCooldown(player.getItemInHand(hand), 80);
			}
			return InteractionResult.SUCCESS;
		}
	}

	/** Five minutes in which game can hardly smell you. */
	public static class ScentEliminator extends Item {
		public ScentEliminator(Properties p) {
			super(p);
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			if (!level.isClientSide()) {
				player.setAttached(HuntingRegistry.SCENT_UNTIL, level.getGameTime() + 20 * 300);
				player.sendOverlayMessage(Component.translatable("hunting.scent.applied"));
				player.getItemInHand(hand).consume(1, player);
			}
			player.playSound(SoundEvents.FIRE_EXTINGUISH, 0.6F, 1.6F);
			return InteractionResult.SUCCESS;
		}
	}

	public static class DogWhistle extends Item {
		public DogWhistle(Properties p) {
			super(p);
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			if (player instanceof ServerPlayer sp) {
				Dogs.whistle(sp);
				player.getCooldowns().addCooldown(player.getItemInHand(hand), 40);
			}
			return InteractionResult.SUCCESS;
		}
	}

	public static class HuntingJournal extends Item {
		public HuntingJournal(Properties p) {
			super(p);
		}

		@Override
		public InteractionResult use(Level level, Player player, InteractionHand hand) {
			player.playSound(SoundEvents.BOOK_PAGE_TURN, 1.0F, 1.0F);
			if (player instanceof ServerPlayer sp) Journal.open(sp);
			return InteractionResult.SUCCESS;
		}
	}
}
