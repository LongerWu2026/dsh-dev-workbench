/** Offline evaluation of real model results against synthetic labels. Does not invoke a model. */
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {evaluateQuality} from '../src/shared/quality-evaluation.ts'
import {QUALITY_SAMPLES} from '../src/shared/quality-samples.ts'
export {evaluateQuality}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2]){console.error('用法: pnpm evaluate:quality <模型结果.json>；格式 [{id,analysis}]。不使用人工构造结果冒充模型评分。');process.exitCode=2}
 else{const labels=QUALITY_SAMPLES;const report=evaluateQuality(labels,JSON.parse(readFileSync(process.argv[2])));console.log(JSON.stringify(report,null,2));if(report.missing.length)process.exitCode=1}
}
