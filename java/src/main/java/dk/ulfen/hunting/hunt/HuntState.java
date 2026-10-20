package dk.ulfen.hunting.hunt;

import java.util.UUID;

import com.mojang.serialization.Codec;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * What the hunt keeps per animal: awareness (Senses), wounds and the carcass (Wounds). Our
 * own animals hold one ({@link dk.ulfen.hunting.entity.GameAnimal}); other mods' creatures
 * carry it as a saved attachment ({@link ForeignTargets}), which also holds their state.
 */
public final class HuntState {
	/** Hunting state of another mod's creature (ours keep it in synced entity data). */
	public int state;
	// Senses (not saved)
	public double awareness;
	public long fleeUntil;
	public @Nullable Vec3 fleeFrom;
	public @Nullable Vec3 lure;
	public long lureUntil;
	// Wounds
	public long bleedUntil = -1;
	public long recoverAt = -1;
	public String blood = "none";
	public double slows;
	public @Nullable UUID shooter;
	public long shotId;
	public String grade = "good";
	public long carcassSince;
	/** 0..1, rolled once: decides weight and trophy score. */
	public float size = -1;
	/** Other mods' creatures: 1 male, 0 female, -1 not rolled yet. */
	public int male = -1;

	public static final Codec<HuntState> CODEC = CompoundTag.CODEC.xmap(HuntState::load, HuntState::save);

	public CompoundTag save() {
		CompoundTag t = new CompoundTag();
		t.putInt("State", this.state);
		t.putLong("BleedUntil", this.bleedUntil);
		t.putLong("RecoverAt", this.recoverAt);
		t.putString("Blood", this.blood);
		t.putDouble("Slows", this.slows);
		if (this.shooter != null) t.putString("Shooter", this.shooter.toString());
		t.putLong("ShotId", this.shotId);
		t.putString("Grade", this.grade);
		t.putLong("CarcassSince", this.carcassSince);
		t.putFloat("Size", this.size);
		t.putInt("Male", this.male);
		return t;
	}

	public static HuntState load(CompoundTag t) {
		HuntState h = new HuntState();
		h.state = t.getIntOr("State", 0);
		h.bleedUntil = t.getLongOr("BleedUntil", -1);
		h.recoverAt = t.getLongOr("RecoverAt", -1);
		h.blood = t.getStringOr("Blood", "none");
		h.slows = t.getDoubleOr("Slows", 0);
		String s = t.getStringOr("Shooter", "");
		h.shooter = s.isEmpty() ? null : UUID.fromString(s);
		h.shotId = t.getLongOr("ShotId", 0);
		h.grade = t.getStringOr("Grade", "good");
		h.carcassSince = t.getLongOr("CarcassSince", 0);
		h.size = t.getFloatOr("Size", -1);
		h.male = t.getIntOr("Male", -1);
		return h;
	}
}
