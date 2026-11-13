import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { FIXTURE_EVENT } from "../events/fixture";
import { sponsorFindings, trackReports } from "./sponsors";

const sigs = FIXTURE_EVENT.sponsorSignatures;
const TRACK = "Best use of Example Maps";
const files = (entries: Record<string, string>) => ({ files: new Map(Object.entries(entries)) });

describe("sponsor tracks", () => {
  test("used: imported or its API host called in app code", () => {
    assert.equal(trackReports(files({ "src/map.ts": 'import { Map } from "example-maps-sdk";' }), sigs)[0].use, "used");
    assert.equal(trackReports(files({ "api/geo.py": 'requests.get("https://api.example-maps.test/v1/route")' }), sigs)[0].use, "used");
  });

  test("installed only: in package.json, never imported", () => {
    const [r] = trackReports(files({ "package.json": '{ "dependencies": { "example-maps-sdk": "1" } }', "src/a.ts": "x" }), sigs);
    assert.equal(r.use, "installed");
    assert.deepEqual(r.evidence, [{ kind: "file", path: "package.json" }]);
  });

  test("an entered track without real use is a finding; one not entered isn't", () => {
    const reports = trackReports(files({ "package.json": '{ "dependencies": { "example-maps-sdk": "1" } }' }), sigs);
    const [f] = sponsorFindings(reports, [TRACK]);
    assert.equal(f.title, `${TRACK}: installed, never called`);
    assert.equal(f.severity, "major");
    assert.deepEqual(sponsorFindings(reports, []), []);
    assert.equal(sponsorFindings(trackReports(files({}), sigs), [TRACK])[0].outcome, "fail");
  });

  test("a mention in the README isn't use", () => {
    assert.equal(trackReports(files({ "README.md": 'import x from "example-maps-sdk"' }), sigs)[0].use, "not_found");
  });
});
