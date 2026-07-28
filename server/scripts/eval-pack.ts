/**
 * 离线 Pack Eval：规则管线回归（升章 / flag / 互聊 / 薄护栏）。
 *
 * 用法：
 *   npm run pack:eval
 *   npm run pack:eval -- --all
 *   npm run pack:eval -- awaken awaken-0717feel__20260717T1450
 *   npm run pack:eval -- --suite eval/cases/awaken/awaken-0717feel__20260717T1450.json
 *
 * 目录与 story-packs 对齐：eval/cases/{world}/{versionDir}.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import { evalSuiteSchema } from '../src/agent/observability/pack-eval.schema';
import { runEvalSuite, type EvalCaseResult, type EvalSuiteResult } from '../src/agent/observability/pack-eval';

const CASES_DIR = path.resolve(__dirname, '..', 'eval', 'cases');

function printCaseFailure(result: EvalCaseResult) {
  console.error(`\n✖ ${result.case_id}`);
  for (const f of result.failures) {
    console.error(
      `  - ${f.field}: expected=${JSON.stringify(f.expected)} actual=${JSON.stringify(f.actual)}`,
    );
  }
  console.error('  --- turn traces (对照 Trace) ---');
  for (const t of result.turns) {
    console.error(
      JSON.stringify(
        {
          turn: t.turn_index,
          player_message: t.player_message,
          chapter: `${t.chapter_before} → ${t.chapter_after}`,
          matched_rule_ids: t.matched_rule_ids,
          flags_set: t.flags_set,
          reply_flags_set: t.reply_flags_set,
          exchange_event_id: t.exchange_event_id,
          mock_reply_slop: t.mock_reply_slop,
          agent_trace_id: t.agent_trace.id,
          transition: t.agent_trace.transition,
          exchange: t.agent_trace.exchange?.event_id,
        },
        null,
        2,
      ),
    );
  }
}

/**
 * 解析套件路径（按优先级）：
 * 1. cases/{world}/{versionDir}.json
 * 2. cases/{world}__{versionDir}.json（旧扁平）
 * 3. cases/{versionDir}.json（更旧）
 */
function resolveSuitePath(worldId: string, versionDir: string): string {
  const byWorld = path.join(CASES_DIR, worldId, `${versionDir}.json`);
  if (fs.existsSync(byWorld)) return byWorld;
  const flatPrefixed = path.join(CASES_DIR, `${worldId}__${versionDir}.json`);
  if (fs.existsSync(flatPrefixed)) return flatPrefixed;
  return path.join(CASES_DIR, `${versionDir}.json`);
}

/** 递归收集 cases/{world}/*.json（跳过根目录杂文件） */
function listSuiteFiles(): string[] {
  if (!fs.existsSync(CASES_DIR)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(CASES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const worldDir = path.join(CASES_DIR, entry.name);
      for (const f of fs.readdirSync(worldDir)) {
        if (f.endsWith('.json')) out.push(path.join(worldDir, f));
      }
      continue;
    }
    // 兼容尚未迁走的扁平文件
    if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(path.join(CASES_DIR, entry.name));
    }
  }
  return out.sort();
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let suitePath: string | undefined;
  let all = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--suite') {
      suitePath = args[++i];
      continue;
    }
    if (a === '--all') {
      all = true;
      continue;
    }
    positional.push(a);
  }
  return { suitePath, all, positional };
}

function runOneSuite(suitePath: string): EvalSuiteResult {
  if (!fs.existsSync(suitePath)) {
    throw new Error(`suite not found: ${suitePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(suitePath, 'utf-8'));
  const suite = evalSuiteSchema.parse(raw);

  const packPath = resolveVersionPath(suite.world_id, suite.pack_version_id);
  if (!fs.existsSync(packPath)) {
    throw new Error(`pack not found: ${packPath}`);
  }

  const pack = loadStoryPackFromDir(packPath);
  const result = runEvalSuite(pack, suite);

  console.log(
    `\nEval suite=${result.suite_id} pack=${result.world_id}/${result.pack_version_id}`,
  );
  console.log(`file=${path.relative(process.cwd(), suitePath)}`);
  console.log(`Passed ${result.passed}/${result.passed + result.failed}`);

  for (const r of result.results) {
    if (r.ok) {
      console.log(`✔ ${r.case_id}`);
    } else {
      printCaseFailure(r);
    }
  }

  return result;
}

function main() {
  const { suitePath: suiteArg, all, positional } = parseArgs(process.argv);

  const suitePaths: string[] = [];

  if (all) {
    suitePaths.push(...listSuiteFiles());
    if (suitePaths.length === 0) {
      console.error(`FAIL no suites in ${CASES_DIR}`);
      process.exit(1);
    }
  } else if (suiteArg) {
    suitePaths.push(path.resolve(suiteArg));
  } else {
    let worldId = 'awaken';
    let versionDir = 'awaken-0717feel__20260717T1450';
    if (positional.length >= 2) {
      worldId = positional[0]!;
      versionDir = positional[1]!;
    } else if (positional.length === 1) {
      versionDir = positional[0]!;
    }
    suitePaths.push(resolveSuitePath(worldId, versionDir));
  }

  let totalPassed = 0;
  let totalFailed = 0;
  const failedSuites: string[] = [];

  for (const suitePath of suitePaths) {
    try {
      const result = runOneSuite(suitePath);
      totalPassed += result.passed;
      totalFailed += result.failed;
      if (result.failed > 0) {
        failedSuites.push(result.suite_id);
      }
    } catch (err) {
      totalFailed += 1;
      failedSuites.push(path.basename(suitePath));
      console.error(
        `\nFAIL ${suitePath}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `\n==== Summary: ${suitePaths.length} suite(s), cases ${totalPassed} passed / ${totalFailed} failed ====`,
  );

  if (totalFailed > 0 || failedSuites.length > 0) {
    if (failedSuites.length) {
      console.error(`Failed suites: ${failedSuites.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('OK all cases passed');
}

try {
  main();
} catch (err) {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
