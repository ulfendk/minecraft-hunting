package dk.ulfen.hunting.client;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import dk.ulfen.hunting.hunt.HuntingData;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import org.jspecify.annotations.Nullable;

/** The full shot report: the x-ray with the bullet's path, and every number (press R after a shot). */
public class ShotReportScreen extends Screen {
	private final JsonObject r;
	private final @Nullable Screen back;

	public ShotReportScreen(JsonObject report, @Nullable Screen back) {
		super(Component.translatable("hunting.report.title", Component.translatable("entity.hunting." + report.get("species").getAsString())));
		this.r = report;
		this.back = back;
	}

	public static ChatFormatting gradeColor(String grade) {
		return switch (grade) {
			case "perfect" -> ChatFormatting.GREEN;
			case "good" -> ChatFormatting.DARK_GREEN;
			case "poor" -> ChatFormatting.GOLD;
			case "unethical" -> ChatFormatting.RED;
			default -> ChatFormatting.GRAY;
		};
	}

	@Override
	protected void init() {
		this.addRenderableWidget(Button.builder(Component.translatable("hunting.journal.back"), b -> this.onClose())
			.bounds(this.width / 2 - 50, this.height - 28, 100, 20).build());
	}

	@Override
	public void onClose() {
		this.minecraft.gui.setScreen(this.back);
	}

	private List<Component> lines() {
		List<Component> out = new ArrayList<>();
		String grade = r.get("grade").getAsString();
		out.add(Component.translatable("hunting.grade." + grade).withStyle(gradeColor(grade), ChatFormatting.BOLD));
		out.add(Component.translatable("hunting.report.distance", String.valueOf(r.get("distance").getAsLong())));
		out.add(Component.translatable("hunting.report.weapon", r.get("calibre").getAsString()));
		out.add(Component.translatable("hunting.report.energy", String.valueOf(r.get("energy").getAsLong())));
		if (r.has("pellets") && r.get("pellets").getAsInt() > 1) {
			out.add(Component.translatable("hunting.report.pellets", String.valueOf(r.get("pelletsHit").getAsInt()), String.valueOf(r.get("pellets").getAsInt())));
		}
		out.add(Component.translatable("hunting.report.accuracy", String.valueOf(r.get("accuracy").getAsInt())));
		var zones = r.getAsJsonArray("zones");
		if (!zones.isEmpty()) {
			out.add(Component.translatable("hunting.report.organs").withStyle(ChatFormatting.BOLD));
			List<JsonElement> sorted = new ArrayList<>();
			zones.forEach(sorted::add);
			sorted.sort((a, b) -> Integer.compare(HuntingData.rank(a.getAsJsonArray().get(0).getAsString()), HuntingData.rank(b.getAsJsonArray().get(0).getAsString())));
			for (JsonElement z : sorted) {
				String zone = z.getAsJsonArray().get(0).getAsString();
				boolean vital = HuntingData.zone(zone).vital();
				out.add(Component.literal(" ■ ").withStyle(vital ? ChatFormatting.RED : ChatFormatting.GRAY)
					.append(Component.translatable("hunting.zone." + zone).withStyle(ChatFormatting.WHITE)).append(" " + z.getAsJsonArray().get(1).getAsInt() + "%"));
			}
			if (r.has("entrySide")) out.add(Component.translatable("hunting.report.entry", Component.translatable("hunting.side." + r.get("entrySide").getAsString())));
			out.add(r.has("exitSide") ? Component.translatable("hunting.report.exit", Component.translatable("hunting.side." + r.get("exitSide").getAsString()))
				: Component.translatable("hunting.report.no_exit"));
			out.add(Component.translatable("hunting.report.blood", Component.translatable("hunting.blood." + r.get("blood").getAsString())));
		}
		String fate = r.get("fate").getAsString();
		MutableComponent outcome = fate.equals("mortal")
			? Component.translatable("hunting.report.outcome.mortal", String.valueOf(Math.round(r.get("bleed").getAsDouble() * 5)))
			: Component.translatable("hunting.report.outcome." + (grade.equals("miss") ? "miss" : fate));
		out.add(outcome.withStyle(ChatFormatting.BOLD));
		for (JsonElement n : r.getAsJsonArray("notes")) {
			if (!n.getAsString().equals("no_exit")) out.add(Component.translatable("hunting.report.note." + n.getAsString()).withStyle(ChatFormatting.GOLD));
		}
		if (r.has("kg")) out.add(Component.translatable("hunting.report.recovered", String.valueOf(r.get("kg").getAsDouble()), String.valueOf(r.get("score").getAsDouble())).withStyle(ChatFormatting.GREEN));
		return out;
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		super.extractRenderState(g, mouseX, mouseY, partialTick);
		g.centeredText(this.font, this.title, this.width / 2, 8, 0xFFFFFFFF);
		List<Component> lines = lines();
		int top = 24, bottom = this.height - 34;
		if (this.width >= 360) {
			// X-ray on the left, the numbers on the right (wrapped to fit).
			int xw = Math.min(512, (int) (this.width * 0.5)), xh = xw / 2;
			if (xh > bottom - top) { xh = bottom - top; xw = xh * 2; }
			int x = 10;
			HuntingHud.draw(g, this.r, x, top, xw, xh);
			int tx = x + xw + 10, tw = this.width - tx - 8, y = top;
			for (Component line : lines) y = g.textWithWordWrap(this.font, line, tx, y, tw, 0xFFE0E0E0) + 1;
		} else {
			int xw = Math.min(this.width - 24, 2 * Math.max(48, (bottom - top - lines.size() * 11) / 2)), xh = xw / 2;
			HuntingHud.draw(g, this.r, (this.width - xw) / 2, top, xw, xh);
			int y = top + xh + 4;
			for (Component line : lines) {
				g.centeredText(this.font, line, this.width / 2, y, 0xFFE0E0E0);
				y += 11;
			}
		}
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
