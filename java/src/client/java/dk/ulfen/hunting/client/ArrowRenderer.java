package dk.ulfen.hunting.client;

import com.geckolib.constant.DataTickets;
import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;
import com.geckolib.renderer.base.RenderPassInfo;
import com.mojang.math.Axis;

import dk.ulfen.hunting.HuntingRegistry;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.EntityRenderState;

/** The broadhead arrow, pointing along its flight path. */
public class ArrowRenderer<T extends net.minecraft.world.entity.Entity & com.geckolib.animatable.GeoAnimatable> extends GeoEntityRenderer<T, EntityRenderState> {
	public ArrowRenderer(EntityRendererProvider.Context context, String model) {
		super(context, new DefaultedEntityGeoModel<>(HuntingRegistry.id(model)));
	}

	/**
	 * Projectiles store yaw as atan2(dx, dz) (mobs use the opposite sign) and pitch as positive
	 * when climbing. The model's tip points to -z, so yaw by 180 + yRot and then tilt by xRot.
	 */
	@Override
	public void adjustRenderPose(RenderPassInfo<EntityRenderState> info) {
		float yaw = info.renderState().getOrDefaultGeckolibData(DataTickets.ENTITY_YAW, 0f);
		float pitch = info.renderState().getOrDefaultGeckolibData(DataTickets.ENTITY_PITCH, 0f);
		info.poseStack().rotateDegrees(Axis.YP, 180f + yaw);
		info.poseStack().rotateDegrees(Axis.XP, pitch);
	}
}
