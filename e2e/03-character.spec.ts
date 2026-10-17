import { GLASSES, HAIR_STYLES, HEADWEAR } from "../shared/appearance.ts";
import { test, expect } from "./fixtures";

test("what Ana changes in the menu is what Beto sees on her", async ({
  join,
}) => {
  const ana = await join("Ana");
  const beto = await join("Beto");
  const seenOnAna = async () =>
    (await beto.stats()).players.find((player) => player.name === "Ana")?.look;
  await expect.poll(seenOnAna).toBeDefined();
  const before = await seenOnAna();

  await ana.openMenu();
  await ana.menuItem("Your character");
  await ana.menu.getByRole("tab", { name: "Hair" }).click();
  await ana.menu.getByRole("radio", { name: "Mohawk" }).click();
  await ana.menu.getByRole("tab", { name: "Face" }).click();
  await ana.menu.getByRole("radio", { name: "Sunglasses" }).click();
  await ana.menu.getByRole("tab", { name: "Extras" }).click();
  await ana.menu.getByRole("radio", { name: "Cap" }).click();

  expect(await seenOnAna()).toEqual(before);
  await ana.menu.getByRole("button", { name: "Save", exact: true }).click();
  await expect(ana.menu).toContainText("Saved. Everybody sees your new look.");

  await expect.poll(seenOnAna).toMatchObject({
    hairStyle: HAIR_STYLES.indexOf("mohawk"),
    glasses: GLASSES.indexOf("sunglasses"),
    headwear: HEADWEAR.indexOf("cap"),
  });
});
