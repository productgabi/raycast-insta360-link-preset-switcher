import { showHUD, updateCommandMetadata } from "@raycast/api";
import { applySlot } from "./lib/camera";

export default async function Command() {
  try {
    const preset = await applySlot(1);
    // Reflect the assigned preset's name in this command's subtitle (Raycast
    // command titles are static; the subtitle is the closest dynamic label).
    await updateCommandMetadata({ subtitle: preset.name });
    await showHUD(`📷 ${preset.name}`);
  } catch (err) {
    await showHUD(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
  }
}
