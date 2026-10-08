import assert from "node:assert/strict";
import test from "node:test";
import { isAutomatedAgent } from "../lib/analytics";

test("real browsers are counted", () => {
  for (const ua of [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  ]) assert.equal(isAutomatedAgent(ua), false, ua);
});

test("crawlers, unfurlers, scripts and our QA crawl are not counted as clicks", () => {
  for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "WhatsApp/2.23", "curl/8.4.0", "python-requests/2.31", "node-fetch/1.0", "HeadlessChrome/120", "findmytech-crawl-qa", "saasfinder-crawl-qa", "Mozilla/5.0 (compatible; UptimeRobot/2.0)"]) {
    assert.equal(isAutomatedAgent(ua), true, ua);
  }
  assert.equal(isAutomatedAgent(null), true, "redirect requests without a user agent are not clicks");
  assert.equal(isAutomatedAgent("", { emptyIsAutomated: false }), false, "beacons may omit the header in tests/older clients");
});
