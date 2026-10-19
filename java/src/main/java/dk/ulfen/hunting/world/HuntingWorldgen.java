package dk.ulfen.hunting.world;

import java.util.function.Predicate;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.fabricmc.fabric.api.biome.v1.BiomeModifications;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectionContext;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectors;
import net.fabricmc.fabric.api.tag.convention.v2.ConventionalBiomeTags;
import net.minecraft.tags.BiomeTags;
import net.minecraft.world.entity.MobCategory;

/** Natural spawns, from the biome groups used in the shared specs. */
public final class HuntingWorldgen {
	private HuntingWorldgen() {}

	private static Predicate<BiomeSelectionContext> biomes(String name) {
		return switch (name) {
			case "forest" -> BiomeSelectors.tag(BiomeTags.IS_FOREST);
			case "taiga" -> BiomeSelectors.tag(BiomeTags.IS_TAIGA);
			case "plains" -> BiomeSelectors.tag(ConventionalBiomeTags.IS_PLAINS);
			case "swamp" -> BiomeSelectors.tag(ConventionalBiomeTags.IS_SWAMP);
			case "river" -> BiomeSelectors.tag(BiomeTags.IS_RIVER);
			case "mountains" -> BiomeSelectors.tag(BiomeTags.IS_MOUNTAIN);
			default -> throw new IllegalArgumentException("Unknown biome group " + name);
		};
	}

	public static void register() {
		for (Species s : SpeciesRegistry.all()) {
			for (Species.Spawn spawn : s.spawns()) {
				Predicate<BiomeSelectionContext> selector = spawn.biomes().stream().map(HuntingWorldgen::biomes).reduce(Predicate::or).orElse(c -> false);
				BiomeModifications.addSpawn(selector, MobCategory.CREATURE, HuntingRegistry.ANIMALS.get(s.id()), spawn.weight(), spawn.min(), spawn.max());
			}
		}
	}
}
