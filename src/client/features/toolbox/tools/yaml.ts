import { parseDocument, stringify } from 'yaml'
import { Btn, Field, Textarea, h } from '../../../core/runtime.js'
import { toolCopyButton, toolErrorBlock, toolMonoStyle, toolOutputBlock } from '../shared-controls.js'

/** Browser-only YAML conversion. The JSON target cannot represent aliases or custom types. */
const yamlScalarRe = /^(?:[^#\s][^#]*|)$/;
function yamlParse(text:unknown):unknown {
    const source=String(text);
    const document=parseDocument(source,{uniqueKeys:true,prettyErrors:true,strict:true});
    if(document.errors.length)throw new Error(document.errors[0].message);
    if(document.warnings.length)throw new Error('不支持的 YAML 语义：'+document.warnings[0].message);
    return document.toJS({maxAliasCount:0});
}
function yamlEmit(value:unknown):string {
    return stringify(value,{indent:2,lineWidth:0,aliasDuplicateObjects:false}).trimEnd();
}
// Retained names for existing callers; all parsing now has one implementation.
function yamlScalar(text:unknown):unknown { return yamlParse(text); }
function yamlUnquote(text:unknown):unknown { return yamlParse(text); }
function yamlQuoteIfNeeded(text:unknown):string { return yamlEmit(String(text)); }

function toolYamlPane(props?: any): any {
    const value = props.value || {};
    function toJson(): any {
        const text = String(value.input || '');
        if (!text.trim()) {
            props.patch({ output: '', error: '请先输入 YAML 文本' });
            return;
        }
        try {
            props.patch({ output: JSON.stringify(yamlParse(text), null, 2), error: '' });
        }
        catch (error) {
            props.patch({ output: '', error: String((error && error.message) || error) });
        }
    }
    function toYaml(): any {
        const text = String(value.input || '');
        if (!text.trim()) {
            props.patch({ output: '', error: '请先输入 JSON 文本' });
            return;
        }
        try {
            props.patch({ output: yamlEmit(JSON.parse(text)), error: '' });
        }
        catch (error) {
            props.patch({ output: '', error: 'JSON 解析失败：' + String((error && error.message) || error) });
        }
    }
    return h('div', { className: 'wb-stack', style: { gap: 12 } }, h('div', { className: 'wb-split' }, h(Field, { label: '输入（YAML 或 JSON）' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(210),
        placeholder: 'name: dev-workbench\ntags:\n  - offline\n  - browser',
        onChange: function (event?: any): any {
            props.patch({ input: event.target.value });
        },
    })), h('div', { className: 'wb-stack', style: { gap: 8 } }, h('div', { className: 'wb-row wb-row--wrap', style: { gap: 6 } }, h(Btn, { size: 'sm', kind: 'primary', icon: 'arrowRight', onClick: toJson, children: 'YAML → JSON' }), h(Btn, { size: 'sm', icon: 'arrowRight', onClick: toYaml, children: 'JSON → YAML' }), h('div', { className: 'wb-spacer' }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: '转换结果' }))), h('p', { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } }, '支持 YAML 1.2 常用结构、嵌套列表与块文本；转换为 JSON 时拒绝别名及未知标签，重复键会明确报错。'));
}
export { yamlScalarRe, yamlUnquote, yamlScalar, yamlParse, yamlQuoteIfNeeded, yamlEmit, toolYamlPane }
