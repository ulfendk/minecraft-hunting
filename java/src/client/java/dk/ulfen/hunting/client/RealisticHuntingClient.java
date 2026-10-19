package dk.ulfen.hunting.client;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.GameCreature;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.renderer.entity.EntityRenderers;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;

public class RealisticHuntingClient implements ClientModInitializer {
	@Override
	@SuppressWarnings("unchecked")
	public void onInitializeClient() {
		for (EntityType<? extends Mob> type : HuntingRegistry.ANIMALS.values()) {
			registerAnimal((EntityType<AnimalType>) (EntityType<?>) type);
		}
		EntityRenderers.register(HuntingRegistry.BROADHEAD_ARROW, ctx -> new ArrowRenderer<>(ctx, "broadhead_arrow"));
		ClientHunting.init();
		HuntingHud.init();
	}

	private static <T extends Mob & GameCreature> void registerAnimal(EntityType<T> type) {
		EntityRenderers.register(type, context -> new GameAnimalRenderer<>(context, type));
	}

	/** Type-only helper so the raw entity types can be passed to the generic registration. */
	private abstract static class AnimalType extends Mob implements GameCreature {
		private AnimalType() {
			super(null, null);
		}
	}
}
