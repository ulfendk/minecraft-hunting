package dk.ulfen.hunting;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import com.mojang.serialization.Codec;

import dk.ulfen.hunting.entity.BroadheadArrow;
import dk.ulfen.hunting.entity.GameAnimal;
import dk.ulfen.hunting.entity.HuntingDog;
import dk.ulfen.hunting.item.BroadheadArrowItem;
import dk.ulfen.hunting.item.CompoundBowItem;
import dk.ulfen.hunting.item.GearItems;
import dk.ulfen.hunting.item.RifleItem;
import dk.ulfen.hunting.item.ShotgunItem;
import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;
import net.fabricmc.fabric.api.creativetab.v1.FabricCreativeModeTab;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.ItemTags;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.SpawnPlacementTypes;
import net.minecraft.world.entity.SpawnPlacements;
import net.minecraft.world.food.FoodProperties;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.ToolMaterial;
import net.minecraft.world.item.equipment.ArmorMaterial;
import net.minecraft.world.item.equipment.ArmorType;
import net.minecraft.world.item.equipment.EquipmentAsset;
import net.minecraft.world.item.equipment.EquipmentAssets;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.material.MapColor;

/** Everything the mod adds to the game registries. */
public final class HuntingRegistry {
	public static final Map<String, EntityType<? extends Mob>> ANIMALS = new LinkedHashMap<>();
	public static final Map<String, Item> SPAWN_EGGS = new LinkedHashMap<>();
	public static final Map<String, Item> ITEMS = new LinkedHashMap<>();
	public static final Set<Item> GHILLIE = new java.util.HashSet<>();

	public static EntityType<BroadheadArrow> BROADHEAD_ARROW;
	public static Block CAMO_NETTING;
	public static Block TREE_STAND;

	// Player data (persistent, kept on death).
	public static final AttachmentType<List<String>> SHOTS = list("shots");
	public static final AttachmentType<List<String>> TROPHIES = list("trophies");
	public static final AttachmentType<List<String>> SEEN = list("seen_game");
	public static final AttachmentType<Boolean> JOURNAL_GIVEN = AttachmentRegistry.<Boolean>builder()
		.persistent(Codec.BOOL).copyOnDeath().initializer(() -> false).buildAndRegister(id("journal_given"));
	public static final AttachmentType<Long> SCENT_UNTIL = AttachmentRegistry.<Long>builder()
		.persistent(Codec.LONG).initializer(() -> 0L).buildAndRegister(id("scent_until"));

	private HuntingRegistry() {}

	private static AttachmentType<List<String>> list(String name) {
		return AttachmentRegistry.<List<String>>builder().persistent(Codec.STRING.listOf()).copyOnDeath().initializer(ArrayList::new).buildAndRegister(id(name));
	}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(RealisticHunting.MOD_ID, path);
	}

	public static Item item(String name) {
		Item i = ITEMS.get(name);
		if (i == null) throw new IllegalArgumentException("Unknown item hunting:" + name);
		return i;
	}

	static void register() {
		registerEntities();
		registerBlocks();
		registerItems();
		registerCreativeTab();
	}

	// ---------------------------------------------------------------- entities

	private static <T extends net.minecraft.world.entity.Entity> EntityType<T> entity(String name, EntityType.Builder<T> builder) {
		ResourceKey<EntityType<?>> key = ResourceKey.create(Registries.ENTITY_TYPE, id(name));
		return Registry.register(BuiltInRegistries.ENTITY_TYPE, key, builder.build(key));
	}

	private static void registerEntities() {
		for (Species s : SpeciesRegistry.all()) {
			EntityType<? extends Mob> type;
			if (s.companion()) {
				EntityType<HuntingDog> t = entity(s.id(), EntityType.Builder.<HuntingDog>of(HuntingDog::new, MobCategory.CREATURE).sized(s.width(), s.height()).clientTrackingRange(10));
				FabricDefaultAttributeRegistry.register(t, HuntingDog.createAttributes(s));
				SpawnPlacements.register(t, SpawnPlacementTypes.ON_GROUND, Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, GameAnimal::checkSpawn);
				type = t;
			} else {
				EntityType<GameAnimal> t = entity(s.id(), EntityType.Builder.<GameAnimal>of(GameAnimal::new, MobCategory.CREATURE).sized(s.width(), s.height()).clientTrackingRange(12));
				FabricDefaultAttributeRegistry.register(t, GameAnimal.createAttributes(s));
				SpawnPlacements.register(t, s.flies() ? SpawnPlacementTypes.NO_RESTRICTIONS : SpawnPlacementTypes.ON_GROUND,
					Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, GameAnimal::checkSpawn);
				type = t;
			}
			ANIMALS.put(s.id(), type);
		}
		BROADHEAD_ARROW = entity("broadhead_arrow", EntityType.Builder.<BroadheadArrow>of(BroadheadArrow::new, MobCategory.MISC).noLootTable().sized(0.5F, 0.5F).clientTrackingRange(4).updateInterval(20));
	}

	// ---------------------------------------------------------------- blocks

	private static Block block(String name, Function<BlockBehaviour.Properties, Block> factory, BlockBehaviour.Properties props) {
		ResourceKey<Block> key = ResourceKey.create(Registries.BLOCK, id(name));
		Block block = Registry.register(BuiltInRegistries.BLOCK, key, factory.apply(props.setId(key)));
		item(name, p -> new BlockItem(block, p), new Item.Properties().useBlockDescriptionPrefix());
		return block;
	}

	private static void registerBlocks() {
		CAMO_NETTING = block("camo_netting", Block::new, BlockBehaviour.Properties.of()
			.mapColor(MapColor.PLANT).strength(0.4F).sound(SoundType.WOOL).noOcclusion().ignitedByLava());
		TREE_STAND = block("tree_stand", Block::new, BlockBehaviour.Properties.of()
			.mapColor(MapColor.WOOD).strength(1.0F).sound(SoundType.WOOD).noOcclusion().ignitedByLava());
	}

	// ---------------------------------------------------------------- items

	private static <T extends Item> T item(String name, Function<Item.Properties, T> factory, Item.Properties props) {
		ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, id(name));
		T item = Registry.register(BuiltInRegistries.ITEM, key, factory.apply(props.setId(key)));
		ITEMS.put(name, item);
		return item;
	}

	private static Item food(String name, int nutrition, float saturation) {
		return item(name, Item::new, new Item.Properties().food(new FoodProperties.Builder().nutrition(nutrition).saturationModifier(saturation).build()));
	}

	private static final ResourceKey<EquipmentAsset> GHILLIE_ASSET = ResourceKey.create(EquipmentAssets.ROOT_ID, id("ghillie"));
	private static final ArmorMaterial GHILLIE_MATERIAL = new ArmorMaterial(8,
		Map.of(ArmorType.HELMET, 1, ArmorType.CHESTPLATE, 2, ArmorType.LEGGINGS, 2, ArmorType.BOOTS, 1), 10,
		SoundEvents.ARMOR_EQUIP_LEATHER, 0.0F, 0.0F, ItemTags.REPAIRS_LEATHER_ARMOR, GHILLIE_ASSET);

	private static void registerItems() {
		for (Species s : SpeciesRegistry.all()) {
			EntityType<? extends Mob> type = ANIMALS.get(s.id());
			SPAWN_EGGS.put(s.id(), item(s.id() + "_spawn_egg", net.minecraft.world.item.SpawnEggItem::new, new Item.Properties().spawnEgg(type)));
		}
		item("hunting_journal", GearItems.HuntingJournal::new, new Item.Properties().stacksTo(1));
		item("binoculars", GearItems.Binoculars::new, new Item.Properties().stacksTo(1));
		item("wind_checker", GearItems.WindChecker::new, new Item.Properties().durability(64));
		item("deer_call", p -> new GearItems.Call("deer", SoundEvents.GOAT_AMBIENT, 0.55F, p), new Item.Properties().stacksTo(1));
		item("duck_call", p -> new GearItems.Call("duck", dk.ulfen.hunting.hunt.Sounds.get("entity.chicken.ambient"), 0.7F, p), new Item.Properties().stacksTo(1));
		item("predator_call", p -> new GearItems.Call("predator", SoundEvents.RABBIT_HURT, 1.5F, p), new Item.Properties().stacksTo(1));
		item("scent_eliminator", GearItems.ScentEliminator::new, new Item.Properties().stacksTo(16));
		item("hunting_knife", Item::new, new Item.Properties().sword(ToolMaterial.IRON, 1.0F, -2.0F).durability(250).repairable(Items.IRON_INGOT));
		item("dog_whistle", GearItems.DogWhistle::new, new Item.Properties().stacksTo(1));
		GHILLIE.add(item("ghillie_hood", Item::new, new Item.Properties().humanoidArmor(GHILLIE_MATERIAL, ArmorType.HELMET)));
		GHILLIE.add(item("ghillie_jacket", Item::new, new Item.Properties().humanoidArmor(GHILLIE_MATERIAL, ArmorType.CHESTPLATE)));
		GHILLIE.add(item("ghillie_trousers", Item::new, new Item.Properties().humanoidArmor(GHILLIE_MATERIAL, ArmorType.LEGGINGS)));
		GHILLIE.add(item("ghillie_boots", Item::new, new Item.Properties().humanoidArmor(GHILLIE_MATERIAL, ArmorType.BOOTS)));
		food("raw_venison", 4, 0.3F);
		food("cooked_venison", 9, 0.8F);
		food("raw_game_meat", 3, 0.3F);
		food("cooked_game_meat", 8, 0.8F);
		food("raw_game_bird", 2, 0.3F);
		food("cooked_game_bird", 7, 0.7F);
		item("deer_hide", Item::new, new Item.Properties());
		item("pelt", Item::new, new Item.Properties());
		for (String t : new String[] {"trophy_antlers", "trophy_paddles", "trophy_tusks", "trophy_skull", "trophy_fan"}) item(t, Item::new, new Item.Properties().stacksTo(1));
		for (String r : new String[] {"rifle_243", "rifle_308", "rifle_3006", "rifle_338"}) {
			item(r, p -> new RifleItem(r, p), new Item.Properties().stacksTo(1).durability(900));
		}
		item("shotgun", ShotgunItem::new, new Item.Properties().stacksTo(1).durability(700));
		item("compound_bow", CompoundBowItem::new, new Item.Properties().durability(500));
		for (String c : new String[] {"cartridge_243", "cartridge_308", "cartridge_3006", "cartridge_338", "shotgun_shell"}) item(c, Item::new, new Item.Properties());
		item("broadhead_arrow", BroadheadArrowItem::new, new Item.Properties());
	}

	private static void registerCreativeTab() {
		CreativeModeTab tab = FabricCreativeModeTab.builder()
			.title(Component.translatable("itemGroup.hunting"))
			.icon(() -> new ItemStack(item("rifle_308")))
			.displayItems((params, out) -> {
				ITEMS.forEach((name, i) -> {
					if (!name.endsWith("_spawn_egg")) out.accept(i);
				});
				SPAWN_EGGS.values().forEach(out::accept);
			})
			.build();
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, id("hunting"), tab);
	}
}
