package dk.ulfen.hunting.client;

import com.geckolib.constant.dataticket.DataTicket;
import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;
import com.geckolib.renderer.base.BoneSnapshots;
import com.geckolib.renderer.base.RenderPassInfo;

import dk.ulfen.hunting.entity.GameCreature;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import org.jspecify.annotations.Nullable;

/** Renders any animal in the mod from its GeckoLib model, showing or hiding situational bones. */
public class GameAnimalRenderer<T extends Mob & GameCreature> extends GeoEntityRenderer<T, LivingEntityRenderState> {
	private static final DataTicket<Boolean> TAME = DataTicket.create("hunting_tame", Boolean.class);
	private static final DataTicket<Boolean> BABY = DataTicket.create("hunting_baby", Boolean.class);
	private static final DataTicket<Integer> VARIANT = DataTicket.create("hunting_variant", Integer.class);

	private final Species species;

	public GameAnimalRenderer(EntityRendererProvider.Context context, EntityType<? extends T> type) {
		super(context, new VariantModel<>(BuiltInRegistries.ENTITY_TYPE.getKey(type), SpeciesRegistry.of(type)));
		this.species = SpeciesRegistry.of(type);
		this.shadowRadius = Math.min(1.8F, this.species.width() * this.species.scale() * 0.5F);
	}

	@Override
	public void captureDefaultRenderState(T animatable, @Nullable Void relatedObject, LivingEntityRenderState state, float partialTick) {
		super.captureDefaultRenderState(animatable, relatedObject, state, partialTick);
		state.addGeckolibData(TAME, animatable instanceof net.minecraft.world.entity.TamableAnimal t && t.isTame());

		state.addGeckolibData(BABY, animatable.isBaby());
		state.addGeckolibData(VARIANT, animatable.getVariant());
	}

	@Override
	public void adjustModelBonesForRender(RenderPassInfo<LivingEntityRenderState> info, BoneSnapshots snapshots) {
		boolean tame = info.getOrDefaultGeckolibData(TAME, false);
		boolean baby = info.getOrDefaultGeckolibData(BABY, false);
		int variant = info.getOrDefaultGeckolibData(VARIANT, 0);
		// Antlers, a turkey's fan and similar: adult males (variant 0) only.
		for (String bone : this.species.maleBones()) hide(snapshots, bone, variant != 0 || baby);
		hide(snapshots, "collar", !tame);
	}

	/** Picks the texture for the animal's variant (e.g. a cock pheasant or a hen). */
	private static class VariantModel<T extends com.geckolib.animatable.GeoAnimatable> extends DefaultedEntityGeoModel<T> {
		private final net.minecraft.resources.Identifier[] textures;

		VariantModel(net.minecraft.resources.Identifier id, Species species) {
			super(id);
			java.util.List<String> names = species.variantTextures() == null ? java.util.List.of() : species.variantTextures();
			this.textures = new net.minecraft.resources.Identifier[names.size()];
			for (int i = 0; i < names.size(); i++) {
				String suffix = names.get(i) == null ? "" : "_" + names.get(i);
				this.textures[i] = id.withPath("textures/entity/" + id.getPath() + suffix + ".png");
			}
		}

		@Override
		public net.minecraft.resources.Identifier getTextureResource(com.geckolib.renderer.base.GeoRenderState renderState) {
			Integer variant = renderState.getGeckolibData(VARIANT);
			if (variant != null && variant > 0 && variant < this.textures.length) return this.textures[variant];
			return super.getTextureResource(renderState);
		}
	}

	private static void hide(BoneSnapshots snapshots, String bone, boolean hidden) {
		snapshots.get(bone).ifPresent(b -> b.skipRender(hidden).skipChildrenRender(hidden));
	}
}
