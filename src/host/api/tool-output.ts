

/* ============================================================================
 * dev-workbench host — Agent tools
 *
 * The workbench is only an "AI workbench" if the model can read and write the
 * same objects the UI shows. These five tools are the write-back path from
 * design report §4.4 (createTask / attachResult) expressed as ordinary DSH
 * tools: they mutate the same host state the pages read, so a result an agent
 * records appears in the task center on the next refresh.
 *
 * Every tool returns plain JSON plus a `text` field, so the model gets an
 * unambiguous result either way.
 * ========================================================================== */
function toolText(text?: any): any {
    return [{ type: 'text', text: text }];
}

function toolOutputSchema(): any {
    return {
        type: 'object',
        properties: {
            text: { type: 'string', description: '人类可读的结果摘要。' },
        },
        required: ['text'],
        additionalProperties: true,
    };
}

function renderToolText(args?: any, value?: any): any {
    const text = value && typeof value.text === 'string' ? value.text : JSON.stringify(value);
    return toolText(text);
}
export { toolText, toolOutputSchema, renderToolText }
