package dk.ulfen.hunting.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.object.PlayState;
import com.geckolib.animation.RawAnimation;
import com.geckolib.constant.DataTickets;

import dk.ulfen.hunting.species.Species;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.phys.Vec3;

/** Shared by every animal in the mod: game animals and the hunting dog. */
public interface GameCreature extends GeoEntity {
	/** One-shot animations the server can trigger. */
	String[] ACTIONS = {"attack", "stamp", "pounce"};

	/** Hunting states, as in the Bedrock pack's hunting:state property. */
	int CALM = 0, ALERT = 1, FLEE = 2, WOUNDED = 3, CARCASS = 4;

	Species species();

	boolean isResting();

	void setResting(boolean resting);

	int getVariant();

	/** Client-side countdown while grazing. */
	int eatTicks();

	/** Hunting state (CALM .. CARCASS); companions are always CALM. */
	default int huntState() {
		return CALM;
	}

	/** Play a one-shot animation on all clients, if this species has it. */
	default void playAction(String name) {
		if (species().hasAnimation(name)) triggerAnim("action", name);
	}

	/** Movement/posture animations plus a channel for triggered one-shots. */
	static <T extends Mob & GameCreature> void registerControllers(T creature, AnimatableManager.ControllerRegistrar controllers) {
		Species s = creature.species();
		controllers.add(new AnimationController<T>("move", 4, state -> {
			T e = state.animatable();
			Vec3 v = state.getDataOrDefault(DataTickets.VELOCITY, Vec3.ZERO);
			double speed = Math.sqrt(v.x * v.x + v.z * v.z) * 20;
			String anim = pickMove(e, s, speed);
			return anim == null ? PlayState.STOP : state.setAndContinue(RawAnimation.begin().thenLoop(s.animation(anim)));
		}));
		// A second idle layer (e.g. the elephant's swaying trunk).
		if (s.idle().size() > 1) {
			String extra = s.idle().get(1);
			controllers.add(new AnimationController<T>("ambient", 4, state ->
				state.animatable().isResting() ? PlayState.STOP : state.setAndContinue(RawAnimation.begin().thenLoop(s.animation(extra)))));
		}
		AnimationController<T> action = new AnimationController<>("action", 2, state -> PlayState.STOP);
		for (String name : ACTIONS) {
			if (s.hasAnimation(name)) action.triggerableAnim(name, RawAnimation.begin().thenPlay(s.animation(name)));
		}
		controllers.add(action);
	}

	private static String pickMove(Mob e, Species s, double speed) {
		GameCreature c = (GameCreature) e;
		if (c.huntState() == CARCASS && s.hasAnimation("dead")) return "dead";
		if (c.isResting() && s.hasAnimation("sleep")) return "sleep";
		if (e instanceof net.minecraft.world.entity.TamableAnimal t && t.isInSittingPose() && s.hasAnimation("sit")) return "sit";
		if (s.flies() && !e.onGround() && !e.isInWater() && s.hasAnimation("fly")) return "fly";
		if (e.isInWater() && !e.onGround() && s.hasAnimation("swim")) return "swim";
		if (c.huntState() == ALERT && speed < 0.4 && s.hasAnimation("alert")) return "alert";
		if (c.eatTicks() > 0 && s.hasAnimation("eat")) return "eat";
		if (speed > s.runSpeed() && s.hasAnimation("run")) return "run";
		if (speed > 0.4 && s.hasAnimation("walk")) return "walk";
		String idle = s.idle().isEmpty() ? "idle" : s.idle().get(0);
		return s.hasAnimation(idle) ? idle : null;
	}
}
