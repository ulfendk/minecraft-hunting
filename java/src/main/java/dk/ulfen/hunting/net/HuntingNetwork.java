package dk.ulfen.hunting.net;

import dk.ulfen.hunting.HuntingRegistry;
import dk.ulfen.hunting.hunt.HuntingData;
import dk.ulfen.hunting.hunt.Shooting;
import dk.ulfen.hunting.item.RifleItem;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.server.level.ServerPlayer;

/**
 * Packets: the client asks to fire the scoped rifle (left click while aiming); the server
 * sends shot reports (x-ray flash, R opens the full report) and the journal contents.
 */
public final class HuntingNetwork {
	private HuntingNetwork() {}

	/** Client -> server: fire the rifle being aimed. */
	public record FirePayload() implements CustomPacketPayload {
		public static final Type<FirePayload> TYPE = new Type<>(HuntingRegistry.id("fire"));
		public static final StreamCodec<RegistryFriendlyByteBuf, FirePayload> CODEC = StreamCodec.unit(new FirePayload());

		@Override
		public Type<FirePayload> type() {
			return TYPE;
		}
	}

	/** Server -> client: a shot report as JSON (`flash` = show the x-ray on the HUD now). */
	public record ReportPayload(String json, boolean flash) implements CustomPacketPayload {
		public static final Type<ReportPayload> TYPE = new Type<>(HuntingRegistry.id("report"));
		public static final StreamCodec<RegistryFriendlyByteBuf, ReportPayload> CODEC = StreamCodec.composite(
			ByteBufCodecs.STRING_UTF8, ReportPayload::json, ByteBufCodecs.BOOL, ReportPayload::flash, ReportPayload::new);

		@Override
		public Type<ReportPayload> type() {
			return TYPE;
		}
	}

	/** Server -> client: open the Hunting Journal with this content (JSON). */
	public record JournalPayload(String json) implements CustomPacketPayload {
		public static final Type<JournalPayload> TYPE = new Type<>(HuntingRegistry.id("journal"));
		public static final StreamCodec<RegistryFriendlyByteBuf, JournalPayload> CODEC = StreamCodec.composite(
			ByteBufCodecs.STRING_UTF8, JournalPayload::json, JournalPayload::new);

		@Override
		public Type<JournalPayload> type() {
			return TYPE;
		}
	}

	public static void register() {
		PayloadTypeRegistry.serverboundPlay().register(FirePayload.TYPE, FirePayload.CODEC);
		PayloadTypeRegistry.clientboundPlay().register(ReportPayload.TYPE, ReportPayload.CODEC);
		PayloadTypeRegistry.clientboundPlay().register(JournalPayload.TYPE, JournalPayload.CODEC);
		ServerPlayNetworking.registerGlobalReceiver(FirePayload.TYPE, (payload, context) -> {
			ServerPlayer player = context.player();
			// Only while actually aiming a rifle.
			if (player.isUsingItem() && player.getUseItem().getItem() instanceof RifleItem rifle && HuntingData.FIREARMS.containsKey(rifle.firearm())) {
				Shooting.fire(player, rifle.firearm());
			}
		});
	}

	public static void sendReport(ServerPlayer player, String json, boolean flash) {
		if (ServerPlayNetworking.canSend(player, ReportPayload.TYPE)) ServerPlayNetworking.send(player, new ReportPayload(json, flash));
	}

	public static void sendJournal(ServerPlayer player, String json) {
		if (ServerPlayNetworking.canSend(player, JournalPayload.TYPE)) ServerPlayNetworking.send(player, new JournalPayload(json));
	}
}
