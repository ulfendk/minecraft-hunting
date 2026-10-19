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
import net.minecraft.world.level.biome.Biomes;

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
			case "ocean" -> BiomeSelectors.tag(BiomeTags.IS_OCEAN);
			case "deep_ocean" -> BiomeSelectors.tag(BiomeTags.IS_DEEP_OCEAN);
			case "lukewarm_ocean" -> BiomeSelectors.includeByKey(Biomes.LUKEWARM_OCEAN, Biomes.DEEP_LUKEWARM_OCEAN, Biomes.WARM_OCEAN);
			case "cold_ocean" -> BiomeSelectors.includeByKey(Biomes.COLD_OCEAN, Biomes.DEEP_COLD_OCEAN);
			default -> throw new IllegalArgumentException("Unknown biome group " + name);
		};
	}

	public static void register() {
		for (Species s : SpeciesRegistry.all()) {
			for (Species.Spawn spawn : s.spawns()) {
				Predicate<BiomeSelectionContext> selector = spawn.biomes().stream().map(HuntingWorldgen::biomes).reduce(Predicate::or).orElse(c -> false);
				MobCategory category = spawn.water() ? MobCategory.WATER_CREATURE : MobCategory.CREATURE;
				BiomeModifications.addSpawn(selector, category, HuntingRegistry.ANIMALS.get(s.id()), spawn.weight(), spawn.min(), spawn.max());
			}
		}
	}
}
