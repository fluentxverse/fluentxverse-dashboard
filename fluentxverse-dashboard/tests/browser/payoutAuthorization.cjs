const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { chromium } = require("playwright");
const base = process.env.PAYOUT_UI_URL || "http://127.0.0.1:5231";
const output = resolve(__dirname, "../../../output/screenshots/payout-authorization");
mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try {
    for (const width of [1440, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }),
        calls = [],
        errors = [];
      let approved = false,
        reserved = false,
        phase = null,
        ready = false,
        cancelled = false,
        revoked = false;
      await context.route("**/admin/**", async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname,
          method = request.method();
        const headers = {
          "access-control-allow-origin": base,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
          "access-control-allow-headers": "content-type",
        };
        if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
        if(revoked&&path.startsWith('/admin/operations/compensation'))return route.fulfill({status:403,json:{success:false,error:'Finance permission required.'},headers});
        calls.push({ path, method, body: method === "POST" ? request.postDataJSON() : null });
        let result = { success: true, data: [] };
        if (path === "/admin/me")
          result = { success: true, user: { userId: "qa-finance", username: "Finance", role: "admin" } };
        else if (path === "/admin/operations/access") result.data = { permissions: ["finance"] };
        else if (path === "/admin/tutors")
          result.data = {
            total: 1,
            tutors: [
              {
                id: "privacy-qa",
                name: "Synthetic Tutor",
                email: "tutor@example.test",
                status: "certified",
                languages: ["English"],
                writtenExamPassed: true,
                speakingExamPassed: true,
              },
            ],
          };
        else if (path === "/admin/operations/people/tutor/privacy-qa")
          result.data = {
            person: { name: "Synthetic Tutor", email: "tutor@example.test" },
            lessons: [],
            penalties: [],
            reports: [],
            transactions: [],
            performance: null,
            progress: [],
            role: "tutor",
          };
        else if (path === "/admin/operations/compensation")
          result.data = [{ tutorId: "privacy-qa", currency: "USD", baseRateCents: 1234, version: 1 }];
        else if (path === "/admin/operations/compensation/privacy-qa")
          result.data = {
            compensation: { tutorId: "privacy-qa", currency: "USD", baseRateCents: 1234, version: 1 },
            history: [],
            nextHistoryBeforeVersion: null,
          };
        else if (path.endsWith("/payout-authorization/readiness"))
          result.data = {
            ready,
            reason: "Approved payout release is not configured.",
            releasePolicy: "self-operated",
            submissionsEnabled: false,
            transferEnabled: false,
          };
        else if (path.endsWith("/earnings/lesson-qa")) {
          approved = true;
          result.data = {};
        } else if (path.endsWith("/earnings"))
          result.data = approved
            ? [
                {
                  bookingId: "lesson-qa",
                  netCents: 1234,
                  completionAt: new Date().toISOString(),
                  status: reserved && !cancelled ? "reserved" : "unclaimed",
                },
              ]
            : [];
        else if (path.endsWith("/payouts")) {
          if (method === "POST") {
            reserved = true;
            result.data = {};
          } else
            result.data = reserved
              ? [
                  {
                    batch: {
                      id: "batch-qa",
                      status: cancelled ? "cancelled" : "reserved",
                      totalCents: 1234,
                      expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    },
                    canCancel: !cancelled,
                  },
                ]
              : [];
        } else if (path.endsWith("/batch-qa/authorization")) {
          if (method === "POST") phase = "locally_proved";
          result.data = {
            authorization: phase ? { phase, updatedAt: new Date().toISOString() } : null,
            currentlyEligible: !cancelled,
            transferEnabled: false,
          };
        } else if (path.endsWith("/batch-qa/cancel")) {
          cancelled = true;
          result.data = {};
        }
        return route.fulfill({ json: result, headers });
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/operations/people/tutor/privacy-qa?tab=compensation");
      const panel = page.locator(".payout-authorization");
      await panel.getByText("No approved earnings", { exact: true }).waitFor();
      await panel.getByLabel("Booking ID", { exact: true }).fill("lesson-qa");
      await panel.getByLabel("Approval reason", { exact: true }).fill("Synthetic completed lesson");
      await panel.getByRole("button", { name: "Approve earning", exact: true }).click();
      await panel.getByRole("checkbox", { name: "Select lesson-qa" }).waitFor();
      await panel.getByRole("checkbox", { name: "Select lesson-qa" }).check();
      await panel
        .getByLabel("Recipient wallet", { exact: true })
        .fill("0x0000000000000000000000000000000000001234");
      await panel.getByLabel("Reservation reason", { exact: true }).fill("Synthetic payout authorization");
      await panel.getByRole("button", { name: "Reserve $12.34", exact: true }).click();
      await panel.getByRole("button", { name: "Generate proof", exact: true }).waitFor();
      assert(await panel.getByRole("button", { name: "Generate proof", exact: true }).isDisabled());
      ready = true;
      await panel.getByRole("button", { name: "Reload earnings", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".payout-actions button")?.disabled);
      await panel.getByRole("button", { name: "Generate proof", exact: true }).click();
      await panel.getByText("Locally proved", { exact: true }).waitFor();
      assert.equal(await panel.getByRole("button", { name: "Submit to zkVerify", exact: true }).count(), 0);
      assert.equal(await panel.getByRole("button", { name: /^Pay / }).count(), 0);
      assert.equal(calls.filter((c) => c.method === "POST" && c.path.endsWith("/authorization")).length, 1);
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Page overflow",
      );
      assert(
        await page.locator(".account-dialog").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        "Modal overflow",
      );
      assert(
        await panel
          .locator("table")
          .evaluateAll((tables) => tables.every((t) => t.getBoundingClientRect().width >= 720)),
        "Tables must not collapse into unreadable columns",
      );
      assert(
        await panel
          .locator("button")
          .evaluateAll((buttons) => buttons.every((b) => b.scrollWidth <= b.clientWidth + 1)),
        "Button text must fit",
      );
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `payout-${width}.png`) });
      const geometry = await panel
        .locator("button,input")
        .evaluateAll((elements) =>
          elements
            .filter((e) => getComputedStyle(e).display !== "none")
            .map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
        );
      assert(geometry.every((e) => e.width > 0 && e.height > 0));
      await panel.getByRole("button", { name: "Cancel reservation", exact: true }).click();
      await panel.getByLabel("Cancellation reason", { exact: true }).fill("Synthetic cancelled reservation");
      await panel.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
      await panel.getByText("Not currently eligible", { exact: true }).waitFor();
      revoked=true;
      await panel.getByRole('button',{name:'Reload earnings',exact:true}).click();
      await panel.getByRole('alert').filter({hasText:'Finance permission required.'}).waitFor();
      assert.equal(await panel.getByText('lesson-qa',{exact:true}).count(),0,'Revoked access clears earning records');
      assert.equal(await panel.getByText('batch-qa',{exact:true}).count(),0,'Revoked access clears proof history');
      assert.equal(await panel.getByLabel('Recipient wallet',{exact:true}).inputValue(),'');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS payout authorization UI: finance approval, reservation, gated proving, local proof label, disabled native submission/transfer, cancellation and desktop/375px/320px geometry. Fixture APIs only.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
