/** Narrow bridge for the observed Command Code Beam wire contract. Never invent reasoning. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const beamAdapterBaseline='fba125cffc926f44bbbad10ecb6301516cff027a3ef526cefe25076a96c5c8fb'
const bridge=`
            // AIWorkBench: Command Code Beam reasoning replay v1
            // The gateway requires the returned text alongside reasoning_details after tool calls.
            // Same model only; never synthesize a missing historical reasoning field.
            if (model.provider === "command-code" && model.id === "reflection/beam:free" &&
                /^https:\\/\\/api\\.commandcode\\.ai(?:\\/|$)/.test(model.baseUrl) &&
                msg.provider === model.provider && msg.model === model.id && msg.api === model.api &&
                assistantMsg.reasoning_content === undefined && nonEmptyThinkingBlocks.length > 0) {
                assistantMsg.reasoning_content = nonEmptyThinkingBlocks.map(block => block.thinking).join("\\n");
            }`
export function originalBeamAdapter(source){
 const original=source.replace(bridge,'')
 assert.equal(createHash('sha256').update(original).digest('hex'),beamAdapterBaseline,'Unreviewed pi-ai adapter; refusing patch')
 return original
}
export function patchBeamReasoning(source){
 const original=originalBeamAdapter(source)
 if(source!==original)return source
 const anchor='            if (preservedReasoningDetails) {\n                assistantMsg.reasoning_details = preservedReasoningDetails;\n            }'
 assert.equal(source.split(anchor).length,2)
 return source.replace(anchor,anchor+bridge)
}
