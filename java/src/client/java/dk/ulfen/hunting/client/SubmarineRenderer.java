package dk.ulfen.hunting.client;

import com.geckolib.constant.dataticket.DataTicket;
import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;
import com.geckolib.renderer.base.BoneSnapshots;
import com.geckolib.renderer.base.GeoRenderState;
import com.geckolib.renderer.base.RenderPassInfo;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.entity.MiniSubmarine;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.resources.Identifier;
import org.jspecify.annotations.Nullable;

/** The mini submarine: see-through dome, spinning propeller, lamps that glow when they are on. */
public class SubmarineRenderer<R extends LivingEntityRenderState & GeoRenderState> extends GeoEntityRenderer<MiniSubmarine, R> {
	private static final DataTicket<Boolean> LIGHTS = DataTicket.create("hunting_sub_lights", Boolean.class);

	public SubmarineRenderer(EntityRendererProvider.Context context) {
		super(context, new DefaultedEntityGeoModel<>(HuntingRegistry.id("mini_submarine")));
		this.shadowRadius = 0.8F;
	}

	@Override
	public void captureDefaultRenderState(MiniSubmarine sub, @Nullable Void relatedObject, R state, float partialTick) {
		super.captureDefaultRenderState(sub, relatedObject, state, partialTick);
		state.addGeckolibData(LIGHTS, sub.lights());
	}

	@Override
	public void adjustModelBonesForRender(RenderPassInfo<R> info, BoneSnapshots snapshots) {
		boolean on = info.getOrDefaultGeckolibData(LIGHTS, false);
		snapshots.get("lamp_glow").ifPresent(b -> b.skipRender(!on));
	}

	@Override
	public @Nullable RenderType getRenderType(R renderState, Identifier texture) {
		// The dome's glass is half transparent; cutout would draw it solid.
		if (!renderState.isInvisible) return RenderTypes.entityTranslucent(texture);
		return super.getRenderType(renderState, texture);
	}
}
