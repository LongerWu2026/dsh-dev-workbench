export function toolDiffLines(leftText?: any, rightText?: any, ignoreWhitespace = false): any {
    const left = String(leftText === undefined || leftText === null ? '' : leftText).split('\n');
    const right = String(rightText === undefined || rightText === null ? '' : rightText).split('\n');
    if (left.length > 400 || right.length > 400) {
        throw new Error('行数过多（上限 400 行）：当前 ' + left.length + ' / ' + right.length + ' 行，请缩小对比范围');
    }
    const rows: any = [];
    const stats: any = { added: 0, removed: 0, same: 0 };
    const matrix: any = [];
    for (let row = 0; row <= left.length; row += 1)
        matrix.push(new Uint16Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i -= 1) {
        for (let j = right.length - 1; j >= 0; j -= 1) {
            matrix[i][j] =
                (ignoreWhitespace ? left[i].trim() === right[j].trim() : left[i] === right[j]) ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        }
    }
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
        if ((ignoreWhitespace ? left[i].trim() === right[j].trim() : left[i] === right[j])) {
            rows.push({ type: 'same', text: left[i], rightText: right[j] });
            stats.same += 1;
            i += 1;
            j += 1;
        }
        else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
            rows.push({ type: 'del', text: left[i] });
            stats.removed += 1;
            i += 1;
        }
        else {
            rows.push({ type: 'add', text: right[j] });
            stats.added += 1;
            j += 1;
        }
    }
    while (i < left.length) {
        rows.push({ type: 'del', text: left[i] });
        stats.removed += 1;
        i += 1;
    }
    while (j < right.length) {
        rows.push({ type: 'add', text: right[j] });
        stats.added += 1;
        j += 1;
    }
    return { rows: rows, stats: stats };
}

/** Pair each change block without shifting later matching lines or their source numbers. */
export function toolDiffPairs(rows: any[], structured = false): any[] {
    const pairs: any[] = [];
    let leftLine = 1, rightLine = 1;
    for (let index = 0; index < rows.length;) {
        const row = rows[index];
        if (row.type === 'same' || row.type === 'change') {
            pairs.push({type: row.type, left: {line: leftLine++, text: row.leftText ?? row.text}, right: {line: rightLine++, text: row.rightText ?? row.text}});
            index++;
            continue;
        }
        if (structured) {
            pairs.push({type: row.type, left: row.type === 'del' ? {text: row.text} : null, right: row.type === 'add' ? {text: row.text} : null});
            index++;
            continue;
        }
        const removed: string[] = [], added: string[] = [];
        while (index < rows.length && ['add', 'del'].includes(rows[index].type)) {
            const next = rows[index++];
            (next.type === 'del' ? removed : added).push(next.text);
        }
        for (let offset = 0; offset < Math.max(removed.length, added.length); offset++) {
            const left = offset < removed.length ? {line: leftLine++, text: removed[offset]} : null;
            const right = offset < added.length ? {line: rightLine++, text: added[offset]} : null;
            pairs.push({type: left && right ? 'change' : left ? 'del' : 'add', left, right});
        }
    }
    return pairs;
}

/** Bounded character LCS; very long replacements fall back to their changed middle. */
export function toolDiffInline(left: string, right: string): {left: any[], right: any[]} {
    const a = Array.from(left), b = Array.from(right);
    let start = 0, end = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
    const x = a.slice(start, a.length - end), y = b.slice(start, b.length - end);
    const result: {left: any[], right: any[]} = {left: [], right: []};
    const append = (side: 'left' | 'right', text: string, changed: boolean) => {
        if (!text) return;
        const parts = result[side], last = parts[parts.length - 1];
        if (last && last.changed === changed) last.text += text;
        else parts.push({text, changed});
    };
    append('left', a.slice(0, start).join(''), false);
    append('right', b.slice(0, start).join(''), false);
    if (!x.length || !y.length || x.length * y.length > 20000) {
        append('left', x.join(''), true); append('right', y.join(''), true);
    } else {
        const matrix = Array.from({length: x.length + 1}, () => new Uint16Array(y.length + 1));
        for (let i = x.length - 1; i >= 0; i--)
            for (let j = y.length - 1; j >= 0; j--)
                matrix[i][j] = x[i] === y[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        let i = 0, j = 0;
        while (i < x.length || j < y.length) {
            if (i < x.length && j < y.length && x[i] === y[j]) {
                append('left', x[i++], false); append('right', y[j++], false);
            } else if (i < x.length && (j === y.length || matrix[i + 1][j] >= matrix[i][j + 1])) append('left', x[i++], true);
            else append('right', y[j++], true);
        }
    }
    append('left', a.slice(a.length - end).join(''), false);
    append('right', b.slice(b.length - end).join(''), false);
    return result;
}
