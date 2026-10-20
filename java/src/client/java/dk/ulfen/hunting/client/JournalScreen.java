package dk.ulfen.hunting.client;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import dk.ulfen.hunting.species.Species;
import dk.ulfen.hunting.species.SpeciesRegistry;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** The Hunting Journal: shot reports, trophies, the game you've seen, and the wind. */
public class JournalScreen extends Screen {
	private enum Tab { SHOTS, TROPHIES, GAME }

	private static final int PER_PAGE = 8;
	private final JsonObject data;
	private Tab tab = Tab.SHOTS;
	private int page;

	public JournalScreen(JsonObject data) {
		super(Component.translatable("hunting.journal.title"));
		this.data = data;
	}

	private List<JsonElement> list(String key) {
		List<JsonElement> out = new ArrayList<>();
		this.data.getAsJsonArray(key).forEach(out::add);
		return out;
	}

	@Override
	protected void init() {
		int cx = this.width / 2;
		List<JsonElement> shots = list("shots");
		List<JsonElement> trophies = list("trophies");
		List<JsonElement> seen = list("seen");
		int total = 0;
		for (Species ignored : SpeciesRegistry.everything()) total++;
		this.addRenderableWidget(Button.builder(Component.translatable("hunting.journal.shots", String.valueOf(shots.size())), b -> show(Tab.SHOTS)).bounds(cx - 190, 26, 124, 20).build());
		this.addRenderableWidget(Button.builder(Component.translatable("hunting.journal.trophies", String.valueOf(trophies.size())), b -> show(Tab.TROPHIES)).bounds(cx - 62, 26, 124, 20).build());
		this.addRenderableWidget(Button.builder(Component.translatable("hunting.journal.species", String.valueOf(seen.size()), String.valueOf(total)), b -> show(Tab.GAME)).bounds(cx + 66, 26, 124, 20).build());

		if (this.tab == Tab.SHOTS) {
			List<JsonElement> recent = new ArrayList<>(shots);
			java.util.Collections.reverse(recent);
			int from = this.page * PER_PAGE;
			for (int i = from; i < Math.min(recent.size(), from + PER_PAGE); i++) {
				JsonObject s = recent.get(i).getAsJsonObject();
				String grade = s.get("grade").getAsString();
				Component label = Component.translatable("hunting.journal.shot_line", Component.translatable(SpeciesRegistry.nameKey(s.get("species").getAsString())),
					String.valueOf(s.get("distance").getAsLong()), Component.translatable("hunting.grade." + grade).withStyle(ShotReportScreen.gradeColor(grade)));
				this.addRenderableWidget(Button.builder(label, b -> this.minecraft.gui.setScreen(new ShotReportScreen(s, this))).bounds(cx - 150, 54 + (i - from) * 22, 300, 20).build());
			}
			pager(recent.size());
		}
		this.addRenderableWidget(Button.builder(Component.translatable("hunting.journal.back"), b -> this.onClose()).bounds(cx - 50, this.height - 28, 100, 20).build());
	}

	private void pager(int size) {
		int cx = this.width / 2;
		if (this.page > 0) this.addRenderableWidget(Button.builder(Component.literal("<"), b -> { this.page--; this.rebuildWidgets(); }).bounds(cx - 176, this.height - 28, 20, 20).build());
		if ((this.page + 1) * PER_PAGE < size) this.addRenderableWidget(Button.builder(Component.literal(">"), b -> { this.page++; this.rebuildWidgets(); }).bounds(cx + 156, this.height - 28, 20, 20).build());
	}

	private void show(Tab t) {
		this.tab = t;
		this.page = 0;
		this.rebuildWidgets();
	}

	private static String dots(double v) {
		return v >= 1.4 ? "●●●" : v >= 1 ? "●●○" : "●○○";
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		super.extractRenderState(g, mouseX, mouseY, partialTick);
		int cx = this.width / 2;
		g.centeredText(this.font, this.title, cx, 8, 0xFFFFE8B0);
		Component wind = Component.translatable("hunting.wind.reading", Component.translatable("hunting.wind." + this.data.get("windFrom").getAsString()),
			String.valueOf(this.data.get("windSpeed").getAsDouble()), Component.translatable("hunting.wind.strength." + this.data.get("windStrength").getAsInt()));
		g.centeredText(this.font, wind, cx, this.height - 42, 0xFFB0C8E0);
		int y = 56;
		if (this.tab == Tab.SHOTS && list("shots").isEmpty()) g.centeredText(this.font, Component.translatable("hunting.journal.none"), cx, y, 0xFFAAAAAA);
		if (this.tab == Tab.TROPHIES) {
			List<JsonElement> trophies = list("trophies");
			trophies.sort((a, b) -> Double.compare(b.getAsJsonObject().get("score").getAsDouble(), a.getAsJsonObject().get("score").getAsDouble()));
			if (trophies.isEmpty()) g.centeredText(this.font, Component.translatable("hunting.journal.none"), cx, y, 0xFFAAAAAA);
			for (JsonElement e : trophies.subList(0, Math.min(14, trophies.size()))) {
				JsonObject t = e.getAsJsonObject();
				String grade = t.get("grade").getAsString();
				g.centeredText(this.font, Component.translatable("hunting.journal.trophy_line", Component.translatable(SpeciesRegistry.nameKey(t.get("species").getAsString())),
					String.valueOf(t.get("score").getAsDouble()), String.valueOf(t.get("kg").getAsDouble()),
					Component.translatable("hunting.grade." + grade).withStyle(ShotReportScreen.gradeColor(grade))), cx, y, 0xFFE0E0E0);
				y += 12;
			}
		}
		if (this.tab == Tab.GAME) {
			List<String> seen = new ArrayList<>();
			list("seen").forEach(e -> seen.add(e.getAsString()));
			for (Species s : SpeciesRegistry.everything()) {
				if (!seen.contains(s.id())) {
					g.centeredText(this.font, Component.literal("???").withStyle(ChatFormatting.DARK_GRAY), cx, y, 0xFF666666);
				} else {
					Component name = Component.translatable(s.nameKey()).withStyle(ChatFormatting.GOLD);
					Component line = s.game() == null ? name : Component.empty().append(name).append("  ")
						.append(Component.translatable("hunting.journal.senses", dots(s.senses().sight()), dots(s.senses().hearing()), dots(s.senses().smell())).withStyle(ChatFormatting.GRAY))
						.append("  ").append(Component.translatable("hunting.journal.calibre", String.valueOf((int) s.game().minEnergy())).withStyle(ChatFormatting.DARK_GREEN));
					g.centeredText(this.font, line, cx, y, 0xFFE0E0E0);
				}
				y += 12;
			}
		}
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
