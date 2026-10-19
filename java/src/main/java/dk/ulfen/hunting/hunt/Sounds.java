package dk.ulfen.hunting.hunt;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;

/** Vanilla sounds by id (several mob sounds are per-variant in code, but still registered by id). */
public final class Sounds {
	private Sounds() {}

	public static SoundEvent get(String id) {
		SoundEvent s = BuiltInRegistries.SOUND_EVENT.getValue(Identifier.withDefaultNamespace(id));
		return s != null ? s : SoundEvents.UI_BUTTON_CLICK.value();
	}
}
