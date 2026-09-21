import { expect, test } from "@playwright/test";

test("shows API setup status and the approved queue", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("LinkedIn Content Control");
  await expect(page.getByRole("heading", { name: "Connection" })).toBeVisible();
  await expect(page.getByText(/missing runtime settings/i)).toBeVisible();
  await expect(page.getByText("No approved posts are waiting.")).toBeVisible();

  await page.screenshot({
    path: "test-results/control-panel.png",
    fullPage: true
  });
});