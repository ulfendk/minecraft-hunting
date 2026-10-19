package dk.ulfen.hunting.entity;

import java.util.Set;
import java.util.function.Predicate;

import dk.ulfen.hunting.species.Species;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.goal.AvoidEntityGoal;
import net.minecraft.world.entity.ai.goal.GoalSelector;
import net.minecraft.world.entity.ai.goal.LeapAtTargetGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.player.Player;

/** Builds the predator/prey goals from species data (shared by animals and mounts). */
public final class HuntGoals {
	private HuntGoals() {}

	public static Predicate<LivingEntity> typeIn(Iterable<String> ids) {
		Set<String> set = new java.util.HashSet<>();
		ids.forEach(set::add);
		return e -> set.contains(BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).toString());
	}

	public static <T extends PathfinderMob & GameCreature> void addCombat(T mob, Species s, GoalSelector goals, GoalSelector targets) {
		if (!s.fleesFrom().isEmpty()) {
			goals.addGoal(3, new AvoidEntityGoal<>(mob, LivingEntity.class, s.fleeDistance(), 1.3, s.fleeSpeed(), typeIn(s.fleesFrom())));
		}
		if (!s.attacks()) return;

		if (s.leap()) goals.addGoal(2, new LeapAtTargetGoal(mob, 0.4F));
		goals.addGoal(3, new MeleeAttackGoal(mob, s.attackSpeed(), true));

		HurtByTargetGoal hurtBy = new HurtByTargetGoal(mob);
		if (s.alertsPack()) hurtBy.setAlertOthers();
		targets.addGoal(1, hurtBy);

		if (!s.hunts().isEmpty()) {
			Predicate<LivingEntity> prey = typeIn(s.hunts());
			targets.addGoal(4, new NearestAttackableTargetGoal<>(mob, LivingEntity.class, s.huntInterval() * 2, true, false,
				(target, level) -> !mob.isResting() && !mob.isBaby() && prey.test(target) && target.distanceTo(mob) <= s.huntRange()));
		}
		if (s.hostile() != null) {
			Species.Hostile h = s.hostile();
			targets.addGoal(3, new NearestAttackableTargetGoal<>(mob, Player.class, 10, true, false,
				(target, level) -> !mob.isBaby() && target.distanceTo(mob) <= h.range() && switch (h.when()) {
					case "day" -> level.isBrightOutside();
					case "night" -> level.isDarkOutside();
					case "in_water" -> target.isInWater();
					case "in_water_hurt" -> target.isInWater() && target.getHealth() < 14;
					default -> true;
				}));
		}
	}
}
