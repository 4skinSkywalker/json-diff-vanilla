(function (root) {
    'use strict';

    const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const isContainer = value => Array.isArray(value) || isObject(value);
    const MAX_LCS_CELLS = 1000000;
    const ARRAY_LOOKAHEAD = 50;
    const MAX_JSON_DEPTH = 500;

    function assertJsonValue(rootValue) {
        const active = new WeakSet();
        const stack = [{ value: rootValue, depth: 0, exiting: false }];

        while (stack.length) {
            const entry = stack.pop();
            const { value, depth } = entry;
            if (!isContainer(value)) {
                const type = typeof value;
                if (value === null || type === 'string' || type === 'boolean') continue;
                if (type === 'number' && Number.isFinite(value) && Number.isSafeInteger(value)) continue;
                if (type === 'number' && Number.isFinite(value) && !Number.isInteger(value)) continue;
                throw new TypeError('JsonDiffEngine.compare accepts JSON-compatible values only');
            }
            if (entry.exiting) {
                active.delete(value);
                continue;
            }
            if (depth > MAX_JSON_DEPTH) throw new RangeError(`JSON nesting exceeds ${MAX_JSON_DEPTH} levels`);
            if (active.has(value)) throw new TypeError('JsonDiffEngine.compare does not accept cyclic values');
            active.add(value);
            stack.push({ value, depth, exiting: true });
            const children = Array.isArray(value) ? value : Object.values(value);
            for (let index = children.length - 1; index >= 0; index--) {
                stack.push({ value: children[index], depth: depth + 1, exiting: false });
            }
        }
    }

    function structurallyEqual(left, right) {
        if (left === right) return true;

        if (Array.isArray(left) && Array.isArray(right)) {
            return left.length === right.length
                && left.every((value, index) => structurallyEqual(value, right[index]));
        }

        if (isObject(left) && isObject(right)) {
            const leftKeys = Object.keys(left);
            const rightKeys = Object.keys(right);
            return leftKeys.length === rightKeys.length
                && leftKeys.every(key => hasOwn(right, key) && structurallyEqual(left[key], right[key]));
        }

        return false;
    }

    function primitiveText(value) {
        return JSON.stringify(value);
    }

    function propertyPrefix(key) {
        return key === null ? '' : `${JSON.stringify(key)}: `;
    }

    function addComma(rows, side) {
        for (let index = rows.length - 1; index >= 0; index--) {
            const field = `${side}Content`;
            if (rows[index][field] !== null) {
                rows[index][field] += ',';
                return;
            }
        }
    }

    function oneSidedRows(value, side, indent, key) {
        const type = side === 'left' ? 'removed' : 'added';
        const left = side === 'left';
        const rows = [];
        const push = content => rows.push({
            type,
            leftContent: left ? content : null,
            rightContent: left ? null : content
        });
        const padding = '  '.repeat(indent);
        const prefix = propertyPrefix(key);

        if (!isContainer(value)) {
            push(`${padding}${prefix}${primitiveText(value)}`);
            return rows;
        }

        const opening = Array.isArray(value) ? '[' : '{';
        const closing = Array.isArray(value) ? ']' : '}';
        push(`${padding}${prefix}${opening}`);

        const entries = Array.isArray(value)
            ? value.map((child, index) => [null, child, index])
            : Object.keys(value).map(childKey => [childKey, value[childKey], childKey]);

        entries.forEach(([childKey, child], index) => {
            const childRows = oneSidedRows(child, side, indent + 1, childKey);
            if (index < entries.length - 1) addComma(childRows, side);
            rows.push(...childRows);
        });

        push(`${padding}${closing}`);
        return rows;
    }

    function replacementRows(left, right, indent, key) {
        if (!isContainer(left) && !isContainer(right)) {
            const padding = '  '.repeat(indent);
            const prefix = propertyPrefix(key);
            return [{
                type: 'changed',
                leftContent: `${padding}${prefix}${primitiveText(left)}`,
                rightContent: `${padding}${prefix}${primitiveText(right)}`
            }];
        }

        return [
            ...oneSidedRows(left, 'left', indent, key),
            ...oneSidedRows(right, 'right', indent, key)
        ];
    }

    function alignLargeArray(left, right) {
        const aligned = [];
        let i = 0;
        let j = 0;

        while (i < left.length && j < right.length) {
            if (structurallyEqual(left[i], right[j])) {
                aligned.push({ left: left[i++], right: right[j++] });
                continue;
            }

            let nextRight = -1;
            let nextLeft = -1;
            for (let offset = 1; offset <= ARRAY_LOOKAHEAD; offset++) {
                if (nextRight < 0 && j + offset < right.length
                    && structurallyEqual(left[i], right[j + offset])) nextRight = offset;
                if (nextLeft < 0 && i + offset < left.length
                    && structurallyEqual(left[i + offset], right[j])) nextLeft = offset;
                if (nextRight >= 0 || nextLeft >= 0) break;
            }

            if (nextRight >= 0 && (nextLeft < 0 || nextRight <= nextLeft)) {
                for (let count = 0; count < nextRight; count++) aligned.push({ right: right[j++] });
            } else if (nextLeft >= 0) {
                for (let count = 0; count < nextLeft; count++) aligned.push({ left: left[i++] });
            } else {
                aligned.push({ left: left[i++], right: right[j++] });
            }
        }
        while (i < left.length) aligned.push({ left: left[i++] });
        while (j < right.length) aligned.push({ right: right[j++] });
        return aligned;
    }

    function alignArray(left, right) {
        if (left.length * right.length > MAX_LCS_CELLS) {
            return alignLargeArray(left, right);
        }
        const rows = left.length + 1;
        const columns = right.length + 1;
        const lcs = Array.from({ length: rows }, () => Array(columns).fill(0));

        for (let i = left.length - 1; i >= 0; i--) {
            for (let j = right.length - 1; j >= 0; j--) {
                lcs[i][j] = structurallyEqual(left[i], right[j])
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }

        const aligned = [];
        let i = 0;
        let j = 0;
        let removed = [];
        let added = [];

        const flush = () => {
            const paired = Math.min(removed.length, added.length);
            for (let index = 0; index < paired; index++) {
                aligned.push({ left: removed[index], right: added[index] });
            }
            for (let index = paired; index < removed.length; index++) {
                aligned.push({ left: removed[index] });
            }
            for (let index = paired; index < added.length; index++) {
                aligned.push({ right: added[index] });
            }
            removed = [];
            added = [];
        };

        while (i < left.length || j < right.length) {
            if (i < left.length && j < right.length && structurallyEqual(left[i], right[j])) {
                flush();
                aligned.push({ left: left[i], right: right[j] });
                i++;
                j++;
            } else if (j < right.length && (i === left.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
                added.push(right[j++]);
            } else {
                removed.push(left[i++]);
            }
        }
        flush();
        return aligned;
    }

    function compareNode(left, right, leftPresent, rightPresent, indent, key) {
        if (!leftPresent) {
            return { rows: oneSidedRows(right, 'right', indent, key), differenceCount: 1 };
        }
        if (!rightPresent) {
            return { rows: oneSidedRows(left, 'left', indent, key), differenceCount: 1 };
        }
        const equal = structurallyEqual(left, right);
        if (isObject(left) && isObject(right)) {
            return compareObjects(left, right, indent, key);
        }
        if (Array.isArray(left) && Array.isArray(right)) {
            return compareArrays(left, right, indent, key, equal);
        }
        if (equal) {
            const rows = oneSidedRows(left, 'left', indent, key);
            const rightRows = oneSidedRows(right, 'right', indent, key);
            return {
                rows: rows.map((row, index) => ({
                    type: 'unchanged',
                    leftContent: row.leftContent,
                    rightContent: rightRows[index].rightContent
                })),
                differenceCount: 0
            };
        }

        return { rows: replacementRows(left, right, indent, key), differenceCount: 1 };
    }

    function compareObjects(left, right, indent, key) {
        const padding = '  '.repeat(indent);
        const prefix = propertyPrefix(key);
        const rows = [{
            type: 'unchanged',
            leftContent: `${padding}${prefix}{`,
            rightContent: `${padding}${prefix}{`
        }];
        const keys = [...Object.keys(left), ...Object.keys(right).filter(childKey => !hasOwn(left, childKey))];
        let differenceCount = 0;

        keys.forEach((childKey, index) => {
            const result = compareNode(
                left[childKey],
                right[childKey],
                hasOwn(left, childKey),
                hasOwn(right, childKey),
                indent + 1,
                childKey
            );
            const remainingKeys = keys.slice(index + 1);
            if (hasOwn(left, childKey) && remainingKeys.some(nextKey => hasOwn(left, nextKey))) {
                addComma(result.rows, 'left');
            }
            if (hasOwn(right, childKey) && remainingKeys.some(nextKey => hasOwn(right, nextKey))) {
                addComma(result.rows, 'right');
            }
            rows.push(...result.rows);
            differenceCount += result.differenceCount;
        });

        rows.push({ type: 'unchanged', leftContent: `${padding}}`, rightContent: `${padding}}` });
        return { rows, differenceCount };
    }

    function compareArrays(left, right, indent, key, alreadyEqual = false) {
        const padding = '  '.repeat(indent);
        const prefix = propertyPrefix(key);
        const rows = [{
            type: 'unchanged',
            leftContent: `${padding}${prefix}[`,
            rightContent: `${padding}${prefix}[`
        }];
        const aligned = alreadyEqual
            ? left.map((value, index) => ({ left: value, right: right[index] }))
            : alignArray(left, right);
        let differenceCount = 0;

        aligned.forEach((item, index) => {
            const leftPresent = hasOwn(item, 'left');
            const rightPresent = hasOwn(item, 'right');
            const result = compareNode(item.left, item.right, leftPresent, rightPresent, indent + 1, null);
            const remainingItems = aligned.slice(index + 1);
            if (leftPresent && remainingItems.some(nextItem => hasOwn(nextItem, 'left'))) {
                addComma(result.rows, 'left');
            }
            if (rightPresent && remainingItems.some(nextItem => hasOwn(nextItem, 'right'))) {
                addComma(result.rows, 'right');
            }
            rows.push(...result.rows);
            differenceCount += result.differenceCount;
        });

        rows.push({ type: 'unchanged', leftContent: `${padding}]`, rightContent: `${padding}]` });
        return { rows, differenceCount };
    }

    function numberRows(rows) {
        let leftLine = 0;
        let rightLine = 0;
        return rows.map(row => ({
            ...row,
            leftLineNum: row.leftContent === null ? null : ++leftLine,
            rightLineNum: row.rightContent === null ? null : ++rightLine
        }));
    }

    function assertSafeJsonNumbers(text) {
        let index = 0;
        while (index < text.length) {
            if (text[index] === '"') {
                index++;
                while (index < text.length) {
                    if (text[index] === '\\') index += 2;
                    else if (text[index++] === '"') break;
                }
                continue;
            }

            if (text[index] === '-' || /[0-9]/.test(text[index])) {
                const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
                if (match) {
                    const number = Number(match[0]);
                    if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) {
                        throw new RangeError(`Unsafe JSON number: ${match[0]}`);
                    }
                    index += match[0].length;
                    continue;
                }
            }
            index++;
        }
    }

    function parseJsonText(text) {
        assertSafeJsonNumbers(text);
        return JSON.parse(text);
    }

    const JsonDiffEngine = {
        compare(left, right) {
            assertJsonValue(left);
            assertJsonValue(right);
            const result = compareNode(left, right, true, true, 0, null);
            return { rows: numberRows(result.rows), differenceCount: result.differenceCount };
        },
        parseAndCompare(leftText, rightText) {
            return this.compare(parseJsonText(leftText), parseJsonText(rightText));
        },
        structurallyEqual
    };

    class JsonCompareUI {
        constructor(id, opts = {}) {
            this.initializeElements(id, opts);
        }

        initializeElements(id, { left = 'Left JSON', right = 'Right JSON' }) {
            const container = Array.from(document.querySelectorAll('.json-diff-container'))
                .find(element => element.getAttribute('data-id') === String(id));
            if (!container) throw new Error(`JSON diff container "${id}" was not found`);

            this.status = container.querySelector('.diff-status');
            this.diffContent = container.querySelector('.diff-content');
            this.diffView = container.querySelector('.diff-view');
            this.leftLabel = container.querySelector('.diff-column.left-column');
            this.rightLabel = container.querySelector('.diff-column.right-column');
            this.showBtn = container.querySelector('.show-btn');
            this.swapBtn = container.querySelector('.swap-btn');
            const requiredElements = {
                status: this.status,
                diffContent: this.diffContent,
                diffView: this.diffView,
                leftLabel: this.leftLabel,
                rightLabel: this.rightLabel,
                showBtn: this.showBtn,
                swapBtn: this.swapBtn
            };
            const missing = Object.keys(requiredElements).filter(name => !requiredElements[name]);
            if (missing.length) throw new Error(`JSON diff container is missing required elements: ${missing.join(', ')}`);
            this.labels = { left, right };
            this.swapped = false;
            this.hideUnchanged = false;
            this.updateLabels();

            this.showBtn.textContent = 'Mostra solo differenze';
            this.showBtn.addEventListener('click', () => {
                this.hideUnchanged = !this.hideUnchanged;
                this.showBtn.textContent = this.hideUnchanged ? 'Mostra tutto' : 'Mostra solo differenze';
                this.diffView.classList.toggle('hide-unchanged', this.hideUnchanged);
            });

            this.swapBtn.textContent = 'Scambia verso';
            this.swapBtn.addEventListener('click', () => {
                this.swapped = !this.swapped;
                this.updateLabels();
                if (this.leftText !== '' || this.rightText !== '') {
                    const leftText = this.leftText;
                    this.leftText = this.rightText;
                    this.rightText = leftText;
                    this.runDiff();
                }
            });

            this.leftText = '';
            this.rightText = '';
        }

        updateLabels() {
            this.leftLabel.textContent = this.swapped ? this.labels.right : this.labels.left;
            this.rightLabel.textContent = this.swapped ? this.labels.left : this.labels.right;
        }

        diff(left, right) {
            this.leftText = left;
            this.rightText = right;
            this.runDiff();
        }

        runDiff() {
            this.diffContent.textContent = '';
            if (typeof this.leftText !== 'string' || this.leftText.trim() === ''
                || typeof this.rightText !== 'string' || this.rightText.trim() === '') {
                this.showStatus('Please provide JSON in both inputs', 'error');
                return;
            }

            let leftJson;
            let rightJson;
            try {
                leftJson = parseJsonText(this.leftText);
            } catch (error) {
                this.showStatus(error instanceof RangeError ? error.message : 'Invalid JSON in left input', 'error');
                return;
            }
            try {
                rightJson = parseJsonText(this.rightText);
            } catch (error) {
                this.showStatus(error instanceof RangeError ? error.message : 'Invalid JSON in right input', 'error');
                return;
            }

            try {
                const result = JsonDiffEngine.compare(leftJson, rightJson);
                result.rows.forEach(row => this.createDiffLine(
                    row.leftLineNum,
                    row.leftContent,
                    row.rightLineNum,
                    row.rightContent,
                    row.type
                ));
                this.showStatus(
                    result.differenceCount === 0
                        ? '✅ No differences found - JSON objects are identical'
                        : `Found ${result.differenceCount} differences`,
                    'success'
                );
            } catch (error) {
                this.diffContent.textContent = '';
                this.showStatus(`Comparison error: ${error.message}`, 'error');
            }
        }

        createDiffLine(leftLineNum, leftContent, rightLineNum, rightContent, type) {
            const diffLine = document.createElement('div');
            diffLine.className = `diff-line ${type}`;

            const leftNum = document.createElement('div');
            leftNum.className = 'line-number';
            leftNum.textContent = leftLineNum ?? '';

            const leftDiv = document.createElement('div');
            leftDiv.className = 'line-content';
            leftDiv.textContent = leftContent ?? '';

            const rightNum = document.createElement('div');
            rightNum.className = 'line-number';
            rightNum.textContent = rightLineNum ?? '';

            const rightDiv = document.createElement('div');
            rightDiv.className = 'line-content';
            rightDiv.textContent = rightContent ?? '';

            diffLine.append(leftNum, leftDiv, rightNum, rightDiv);
            this.diffContent.appendChild(diffLine);
        }

        showStatus(message, type) {
            this.status.textContent = message;
            this.status.className = `diff-status status ${type}`;
        }
    }

    root.JsonCompareUI = JsonCompareUI;
    root.JsonDiffEngine = JsonDiffEngine;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { JsonCompareUI, JsonDiffEngine };
    }
})(typeof window !== 'undefined' ? window : globalThis);
