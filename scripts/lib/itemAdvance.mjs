/** Wait past the 450 ms lock-in guard before pointer, touch, or keyboard advancement. */
export async function waitForNextItem(page) {
  await page.waitForSelector('[data-testid="next-item"]:not([disabled])')
  // Start after the replacement button is rendered, with a little scheduling margin.
  await new Promise((resolve) => setTimeout(resolve, 500))
}
