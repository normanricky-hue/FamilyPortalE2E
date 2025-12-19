import { Page, APIResponse } from "@playwright/test";

export async function waitForPendingProcessingData(page: Page) {
  const uiRenderRequest = page.waitForResponse(
    res =>
      res.url().includes("records-pending-processing") &&
      res.status() === 200,
    { timeout: 8000 }
  ).catch(() => null);

  const dataRequest = page.waitForResponse(
    res =>
      res.url().includes("pending-processing-records") &&
      res.status() === 200,
    { timeout: 15000 }
  );

  // We MUST wait for dataRequest
  // UI request is optional
  const [, dataResponse] = await Promise.all([
    uiRenderRequest,
    dataRequest
  ]);

  return dataResponse;
}
