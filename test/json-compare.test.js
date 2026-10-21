'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JsonCompareUI, JsonDiffEngine } = require('../json-compare.js');

function changedRows(result) {
    return result.rows.filter(row => row.type === 'changed');
}

function createFakeDocument() {
    class FakeElement {
        constructor() {
            this.children = [];
            this.className = '';
            this._textContent = '';
            this.listeners = {};
            this.classes = new Set();
            this.classList = {
                toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
                contains: name => this.classes.has(name)
            };
        }
        set textContent(value) {
            this._textContent = String(value);
            if (value === '') this.children = [];
        }
        get textContent() { return this._textContent; }
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); }
        addEventListener(event, listener) { this.listeners[event] = listener; }
    }

    const selectors = Object.fromEntries([
        '.diff-status', '.diff-content', '.diff-view',
        '.diff-column.left-column', '.diff-column.right-column', '.show-btn', '.swap-btn'
    ].map(selector => [selector, new FakeElement()]));
    const container = {
        querySelector: selector => selectors[selector],
        getAttribute: name => name === 'data-id' ? 'test' : null
    };
    return {
        document: {
            querySelectorAll: selector => selector === '.json-diff-container' ? [container] : [],
            createElement: () => new FakeElement()
        },
        elements: selectors
    };
}

test('pairs adjacent changed object properties by key', () => {
    const result = JsonDiffEngine.compare(
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Ema', age: 50, city: 'New York' }
    );

    assert.equal(result.differenceCount, 2);
    assert.deepEqual(changedRows(result).map(row => [row.leftContent.trim(), row.rightContent.trim()]), [
        ['"name": "John",', '"name": "Ema",'],
        ['"age": 30,', '"age": 50,']
    ]);
    assert.ok(result.rows.some(row => row.type === 'unchanged'
        && row.leftContent.includes('"city"') && row.rightContent.includes('"city"')));
});

test('renders added and removed object members without mispairing neighbors', () => {
    const result = JsonDiffEngine.compare(
        { retained: 1, removed: { nested: true }, tail: 3 },
        { retained: 1, added: [2, 3], tail: 3 }
    );

    assert.equal(result.differenceCount, 2);
    assert.ok(result.rows.some(row => row.type === 'removed' && row.leftContent.includes('"removed"')));
    assert.ok(result.rows.some(row => row.type === 'added' && row.rightContent.includes('"added"')));
    assert.ok(result.rows.some(row => row.type === 'unchanged' && row.leftContent.includes('"tail"')));
});

test('compares nested object descendants structurally', () => {
    const result = JsonDiffEngine.compare(
        { account: { active: true, profile: { name: 'A' } } },
        { account: { active: false, profile: { name: 'B', level: 2 } } }
    );

    assert.equal(result.differenceCount, 3);
    assert.ok(changedRows(result).some(row => row.leftContent.includes('"active"')));
    assert.ok(changedRows(result).some(row => row.leftContent.includes('"name"')));
    assert.ok(result.rows.some(row => row.type === 'added' && row.rightContent.includes('"level"')));
});

test('aligns array insertions and removals to stable elements', () => {
    const inserted = JsonDiffEngine.compare([1, 3, 4], [1, 2, 3, 4]);
    assert.equal(inserted.differenceCount, 1);
    assert.equal(inserted.rows.filter(row => row.type === 'added').length, 1);
    assert.ok(inserted.rows.some(row => row.type === 'unchanged'
        && row.leftContent.trim().startsWith('3') && row.rightContent.trim().startsWith('3')));

    const removed = JsonDiffEngine.compare(['a', 'b', 'c'], ['a', 'c']);
    assert.equal(removed.differenceCount, 1);
    assert.equal(removed.rows.filter(row => row.type === 'removed').length, 1);
});

test('pairs an array replacement as one change', () => {
    const result = JsonDiffEngine.compare([1, { id: 2 }, 3], [1, { id: 9 }, 3]);
    assert.equal(result.differenceCount, 1);
    assert.ok(changedRows(result).some(row => row.leftContent.includes('"id": 2')));
    assert.ok(result.rows.some(row => row.type === 'unchanged'
        && row.leftContent.trim() === '3' && row.rightContent.trim() === '3'));
});

test('ignores object property order at every depth', () => {
    const result = JsonDiffEngine.compare(
        { first: 1, nested: { a: true, b: false } },
        { nested: { b: false, a: true }, first: 1 }
    );
    assert.equal(result.differenceCount, 0);
    assert.ok(result.rows.every(row => row.type === 'unchanged'));
    assert.ok(result.rows.every(row => row.leftContent === row.rightContent));
});

test('supports primitive roots and JSON type changes', () => {
    assert.equal(JsonDiffEngine.compare(null, null).differenceCount, 0);
    assert.equal(JsonDiffEngine.compare(false, true).differenceCount, 1);
    assert.equal(JsonDiffEngine.compare('1', 1).differenceCount, 1);
    assert.deepEqual(
        changedRows(JsonDiffEngine.compare('old', 'new'))[0],
        {
            type: 'changed',
            leftContent: '"old"',
            rightContent: '"new"',
            leftLineNum: 1,
            rightLineNum: 1
        }
    );
});

test('treats negative zero as the same rendered JSON number', () => {
    const result = JsonDiffEngine.parseAndCompare('-0', '0');
    assert.equal(result.differenceCount, 0);
    assert.equal(result.rows[0].leftContent, '0');
    assert.equal(result.rows[0].rightContent, '0');
});

test('does not pair unrelated lines when container types change', () => {
    const result = JsonDiffEngine.compare({ name: 'A' }, ['B']);
    assert.equal(result.differenceCount, 1);
    assert.equal(result.rows.some(row => row.type === 'changed'), false);
    assert.ok(result.rows.some(row => row.type === 'removed' && row.leftContent.includes('"name"')));
    assert.ok(result.rows.some(row => row.type === 'added' && row.rightContent.includes('"B"')));
});

test('formats multi-line additions and removals as complete subtrees', () => {
    const result = JsonDiffEngine.compare({}, { config: { values: [1, 2] } });
    assert.equal(result.differenceCount, 1);
    const rightText = result.rows.map(row => row.rightContent).filter(value => value !== null).join('\n');
    assert.deepEqual(JSON.parse(rightText), { config: { values: [1, 2] } });
});

test('produces valid JSON in both displayed columns', () => {
    const result = JsonDiffEngine.compare(
        { keep: 1, remove: [1, 2], end: true },
        { add: { x: null }, keep: 1, end: false }
    );
    const leftText = result.rows.map(row => row.leftContent).filter(value => value !== null).join('\n');
    const rightText = result.rows.map(row => row.rightContent).filter(value => value !== null).join('\n');
    assert.deepEqual(JSON.parse(leftText), { keep: 1, remove: [1, 2], end: true });
    assert.deepEqual(JSON.parse(rightText), { keep: 1, end: false, add: { x: null } });
});

test('parseAndCompare rejects invalid and empty JSON text', () => {
    assert.throws(() => JsonDiffEngine.parseAndCompare('', '{}'), SyntaxError);
    assert.throws(() => JsonDiffEngine.parseAndCompare('{}', '{broken'), SyntaxError);
});

test('rejects JSON numbers that cannot be represented safely', () => {
    assert.throws(
        () => JsonDiffEngine.parseAndCompare('{"id":9007199254740992}', '{"id":9007199254740993}'),
        /Unsafe JSON number/
    );
    assert.doesNotThrow(() => JsonDiffEngine.parseAndCompare('{"text":"9007199254740993"}', '{}'));
});

test('rejects non-JSON, cyclic, and excessively nested engine values', () => {
    assert.throws(() => JsonDiffEngine.compare(undefined, null), /JSON-compatible values only/);
    assert.throws(() => JsonDiffEngine.compare(NaN, null), /JSON-compatible values only/);
    const cyclic = {};
    cyclic.self = cyclic;
    assert.throws(() => JsonDiffEngine.compare(cyclic, {}), /cyclic values/);

    let deeplyNested = null;
    for (let depth = 0; depth < 502; depth++) deeplyNested = [deeplyNested];
    assert.throws(() => JsonDiffEngine.compare(deeplyNested, deeplyNested), /nesting exceeds/);
});

test('uses bounded alignment for large arrays without shifting an insertion', () => {
    const left = Array.from({ length: 1100 }, (_, index) => index);
    const right = [...left.slice(0, 550), -1, ...left.slice(550)];
    const result = JsonDiffEngine.compare(left, right);
    assert.equal(result.differenceCount, 1);
    assert.equal(result.rows.filter(row => row.type === 'added').length, 1);
    assert.ok(result.rows.some(row => row.type === 'unchanged'
        && row.leftContent.trim().startsWith('550') && row.rightContent.trim().startsWith('550')));
});

test('browser UI renders rows, supports controls, and clears stale invalid input', () => {
    const originalDocument = global.document;
    const fake = createFakeDocument();
    global.document = fake.document;
    try {
        const ui = new JsonCompareUI('test', { left: 'Before', right: 'After' });
        ui.diff('{"value":1}', '{"value":2}');
        assert.ok(fake.elements['.diff-content'].children.length > 0);
        assert.equal(fake.elements['.diff-status'].textContent, 'Found 1 differences');

        let changedRow = fake.elements['.diff-content'].children.find(row => row.className === 'diff-line changed');
        assert.deepEqual(changedRow.children.map(child => child.textContent), [
            '2', '  "value": 1', '2', '  "value": 2'
        ]);

        fake.elements['.show-btn'].listeners.click();
        assert.equal(fake.elements['.show-btn'].textContent, 'Mostra tutto');
        assert.equal(fake.elements['.diff-view'].classList.contains('hide-unchanged'), true);
        fake.elements['.show-btn'].listeners.click();
        assert.equal(fake.elements['.diff-view'].classList.contains('hide-unchanged'), false);

        fake.elements['.swap-btn'].listeners.click();
        assert.equal(fake.elements['.diff-column.left-column'].textContent, 'After');
        assert.equal(fake.elements['.diff-column.right-column'].textContent, 'Before');
        changedRow = fake.elements['.diff-content'].children.find(row => row.className === 'diff-line changed');
        assert.deepEqual(changedRow.children.map(child => child.textContent), [
            '2', '  "value": 2', '2', '  "value": 1'
        ]);
        fake.elements['.swap-btn'].listeners.click();
        assert.equal(fake.elements['.diff-column.left-column'].textContent, 'Before');
        assert.equal(fake.elements['.diff-column.right-column'].textContent, 'After');

        ui.diff('{broken', '{}');
        assert.equal(fake.elements['.diff-content'].children.length, 0);
        assert.equal(fake.elements['.diff-status'].textContent, 'Invalid JSON in left input');

        ui.diff('{}', '');
        assert.equal(fake.elements['.diff-content'].children.length, 0);
        assert.equal(fake.elements['.diff-status'].textContent, 'Please provide JSON in both inputs');
        assert.equal(global.JsonCompareUI, JsonCompareUI);
    } finally {
        global.document = originalDocument;
    }
});

test('browser UI accepts selector metacharacters in container identifiers', () => {
    const originalDocument = global.document;
    const fake = createFakeDocument();
    fake.document.querySelectorAll = () => [{
        getAttribute: () => 'quote"] id',
        querySelector: selector => fake.elements[selector]
    }];
    global.document = fake.document;
    try {
        assert.doesNotThrow(() => new JsonCompareUI('quote"] id'));
    } finally {
        global.document = originalDocument;
    }
});

test('browser UI reports missing required markup clearly', () => {
    const originalDocument = global.document;
    const fake = createFakeDocument();
    delete fake.elements['.swap-btn'];
    global.document = fake.document;
    try {
        assert.throws(() => new JsonCompareUI('test'), /missing required elements: swapBtn/);
    } finally {
        global.document = originalDocument;
    }
});

test('is deterministic across repeated runs', () => {
    const left = { items: [{ id: 1 }, { id: 2 }], enabled: true };
    const right = { enabled: false, items: [{ id: 0 }, { id: 1 }, { id: 2 }] };
    assert.deepEqual(JsonDiffEngine.compare(left, right), JsonDiffEngine.compare(left, right));
});
