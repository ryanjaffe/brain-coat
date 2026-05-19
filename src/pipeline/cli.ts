/**
 * Headless CLI entry: run one iteration end-to-end against a project on disk.
 *
 *   XAI_API_KEY=... tsx src/pipeline/cli.ts <projects-dir> <project-name>
 */
import path from "node:path";
import { GrokClient } from "./grokClient";
import { ProjectStore } from "../storage/projectStore";
import { runIteration } from "./runIteration";

async function main() {
  const [projectsDir, projectName] = process.argv.slice(2);
  if (!projectsDir || !projectName) {
    console.error("Usage: tsx src/pipeline/cli.ts <projects-dir> <project-name>");
    process.exit(1);
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("XAI_API_KEY env var is required");
    process.exit(1);
  }

  const store = new ProjectStore(path.resolve(projectsDir));
  const brief = store.readBrief(projectName);
  const bank = store.readInputBank(projectName);
  const config = store.readConfig(projectName);
  if (!brief || !bank || !config) {
    console.error("Project missing brief / input bank / config");
    process.exit(1);
  }

  const client = new GrokClient({ apiKey });
  const brainstormId = store.nextBrainstormId(projectName);
  const iter = 1;

  await runIteration({
    store,
    projectName,
    brainstormId,
    iter,
    client,
    brief,
    bank,
    config,
    onEvent: (e) => console.log(`[${e.stage}] ${e.message}`),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
