package dk.ulfen.hunting.mixin.client;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import dk.ulfen.hunting.client.ClientHunting;
import net.minecraft.client.player.AbstractClientPlayer;

/** Zooms in while aiming through a rifle scope or looking through binoculars. */
@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerMixin {
	@Inject(method = "getFieldOfViewModifier", at = @At("RETURN"), cancellable = true)
	private void hunting$zoom(boolean firstPerson, float effectScale, CallbackInfoReturnable<Float> cir) {
		float zoom = ClientHunting.fovModifier((AbstractClientPlayer) (Object) this);
		if (zoom < 1) cir.setReturnValue(zoom);
	}
}
