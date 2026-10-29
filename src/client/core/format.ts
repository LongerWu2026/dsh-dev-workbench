

/* ------------------------------------------------------------------- format */
function parseDate(value?: any): any {
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value?: any): any {
    return value < 10 ? '0' + value : String(value);
}

const fmt: any = {
    date(value?: any): any {
        const date = parseDate(value);
        if (!date)
            return '—';
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    },
    day(value?: any): any {
        const date = parseDate(value);
        if (!date)
            return '—';
        return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    },
    time(value?: any): any {
        const date = parseDate(value);
        if (!date)
            return '—';
        return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    },
    datetime(value?: any): any {
        const date = parseDate(value);
        if (!date)
            return '—';
        return fmt.date(value) + ' ' + fmt.time(value);
    },
    relative(value?: any, now?: any): any {
        const date = parseDate(value);
        if (!date)
            return '—';
        const base = now || Date.now();
        const diff = Math.round((base - date.getTime()) / 1000);
        if (diff < 45)
            return '刚刚';
        if (diff < 3600)
            return Math.max(1, Math.round(diff / 60)) + ' 分钟前';
        if (diff < 86400)
            return Math.round(diff / 3600) + ' 小时前';
        if (diff < 86400 * 30)
            return Math.round(diff / 86400) + ' 天前';
        return fmt.date(value);
    },
    due(value?: any, now?: any): any {
        if (!value)
            return { text: '无截止', tone: 'idle', overdue: false };
        const date = parseDate(value);
        if (!date)
            return { text: '无截止', tone: 'idle', overdue: false };
        const base = now || Date.now();
        const diff = date.getTime() - base;
        const abs = Math.abs(diff);
        const overdue = diff < 0;
        let text;
        if (abs < 3600 * 1000)
            text = overdue ? '刚刚到期' : Math.round(diff / 60000) + ' 分钟后';
        else if (abs < 86400 * 1000)
            text = (overdue ? '逾期 ' : '') + Math.round(abs / 3600000) + ' 小时' + (overdue ? '' : '后');
        else
            text = (overdue ? '逾期 ' : '') + Math.round(abs / 86400000) + ' 天' + (overdue ? '' : '后');
        return { text: text, tone: overdue ? 'err' : abs < 86400000 ? 'warn' : 'idle', overdue: overdue };
    },
    num(value?: any): any {
        const number = Number(value || 0);
        if (Math.abs(number) >= 10000)
            return (number / 1000).toFixed(1) + 'k';
        return String(number);
    },
    /** ISO → value for <input type="datetime-local"> in local time. */
    toLocalInput(value?: any): any {
        const date = parseDate(value);
        if (!date)
            return '';
        return (date.getFullYear() +
            '-' +
            pad2(date.getMonth() + 1) +
            '-' +
            pad2(date.getDate()) +
            'T' +
            pad2(date.getHours()) +
            ':' +
            pad2(date.getMinutes()));
    },
    /** <input type="datetime-local"> value → ISO, or null. */
    fromLocalInput(value?: any): any {
        if (!value)
            return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    },
    bytes(value?: any): any {
        const size = Number(value || 0);
        if (size < 1024)
            return size + ' B';
        if (size < 1024 * 1024)
            return (size / 1024).toFixed(1) + ' KB';
        return (size / 1024 / 1024).toFixed(1) + ' MB';
    },
};

/* -------------------------------------------------------------------- utils */
const util: any = {
    uid(prefix?: any): any {
        const random = Math.random().toString(36).slice(2, 8);
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + random;
    },
    truncate(text?: any, max?: any): any {
        const value = String(text === undefined || text === null ? '' : text);
        return value.length > max ? value.slice(0, max - 1) + '…' : value;
    },
    debounce(fn?: any, wait?: any): any {
        let timer: any = null;
        return function (this: unknown): any {
            const args = arguments;
            const self = this;
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(function (): any {
                timer = null;
                fn.apply(self, args);
            }, wait || 200);
        };
    },
    groupBy(list?: any, keyFn?: any): any {
        const out: any = {};
        (list || []).forEach(function (item?: any): any {
            const key = keyFn(item);
            if (!out[key])
                out[key] = [];
            out[key].push(item);
        });
        return out;
    },
    sortBy(list?: any, keyFn?: any, desc?: any): any {
        return (list || []).slice().sort(function (a?: any, b?: any): any {
            const av = keyFn(a);
            const bv = keyFn(b);
            if (av === bv)
                return 0;
            if (av === null || av === undefined)
                return 1;
            if (bv === null || bv === undefined)
                return -1;
            return (av < bv ? -1 : 1) * (desc ? -1 : 1);
        });
    },
    copy(text?: any): any {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).catch(function (): any {
                return Promise.reject(new Error('复制失败'));
            });
        }
        return Promise.reject(new Error('当前环境不支持剪贴板'));
    },
    nowIso(): any {
        return new Date().toISOString();
    },
};
export { parseDate, pad2, fmt, util }
