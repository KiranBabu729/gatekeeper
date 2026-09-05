import { runEvals, GATES } from "./runner";

function main() {
  const report = runEvals();

  console.log("Gatekeeper eval harness");
  console.log("=======================\n");

  for (const r of report.results) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.id} (${r.category})${r.detail ? " — " + r.detail : ""}`);
  }

  console.log("\nPer-rule precision / recall");
  for (const s of report.ruleStats) {
    console.log(
      `  ${s.ruleId.padEnd(14)} precision=${s.precision.toFixed(2)} recall=${s.recall.toFixed(2)} (tp=${s.tp} fp=${s.fp} fn=${s.fn})`
    );
  }

  console.log(`\nBlock-severity recall: ${(report.blockRecall * 100).toFixed(1)}% (gate: ${GATES.BLOCK_RECALL_GATE * 100}%)`);
  console.log(`Sanitization recall:   ${(report.sanitizationRecall * 100).toFixed(1)}% (gate: ${GATES.SANITIZATION_RECALL_GATE * 100}%)`);
  console.log(`\nGate: ${report.gatePassed ? "PASSED" : "FAILED"}`);

  if (!report.gatePassed) process.exit(1);
}

main();
