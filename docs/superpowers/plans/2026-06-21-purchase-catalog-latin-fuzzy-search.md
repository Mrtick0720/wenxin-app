# Purchase Catalog Latin Fuzzy Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff find purchase catalog items with Latin-letter pinyin, Malay text, and minor spelling mistakes.

**Architecture:** Keep all matching and ranking inside `lib/purchaseLedger/catalog.ts`, preserving the existing `filterCatalogItems` UI contract. Use `pinyin-pro` to derive tone-free pinyin and initials at runtime, then rank exact, prefix, substring, and conservative fuzzy matches.

**Tech Stack:** TypeScript, Node.js test script, `pinyin-pro`

---

### Task 1: Add failing search behavior tests

**Files:**
- Create: `scripts/test-purchase-catalog-search.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a focused test script**

Create catalog fixtures including `绍兴花雕酒` / `Arak Shaoxing Huadiao` and
assert:

```ts
assert.equal(search('saoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('shaoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('huadiao')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('sxhdj')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('arak shaoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('绍兴')[0]?.name_zh, '绍兴花雕酒')
assert.deepEqual(search(''), fixtures)
assert.deepEqual(search('unrelatedvalue'), [])
```

- [ ] **Step 2: Add the npm command**

Add:

```json
"test:purchase-catalog-search": "npx tsx scripts/test-purchase-catalog-search.ts"
```

- [ ] **Step 3: Run the test and confirm failure**

Run:

```bash
npm run test:purchase-catalog-search
```

Expected: `saoxing` does not find the Chinese catalog item with the current
substring-only implementation.

### Task 2: Add pinyin and Latin fuzzy ranking

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/purchaseLedger/catalog.ts`

- [ ] **Step 1: Install the pinyin dependency**

Run:

```bash
npm install pinyin-pro
```

- [ ] **Step 2: Implement Latin search candidates**

For every item derive normalized values for:

- `name_ms`;
- tone-free joined pinyin;
- tone-free spaced pinyin;
- pinyin initials.

- [ ] **Step 3: Implement conservative fuzzy scoring**

Rank exact, prefix, and substring matches before Damerau-Levenshtein-style
fuzzy matches. Enable fuzzy scoring only for Latin queries of at least four
characters, with a threshold proportional to query length.

- [ ] **Step 4: Preserve Chinese search behavior**

If the query contains Han characters, use only the existing normalized Chinese
and Malay substring matching.

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm run test:purchase-catalog-search
```

Expected: all search assertions pass.

### Task 3: Verify and commit

**Files:**
- Verify all files from Tasks 1 and 2

- [ ] **Step 1: Run verification**

Run:

```bash
npm run test:purchase-catalog-search
npx tsc --noEmit
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 2: Commit only the fuzzy-search files**

```bash
git add \
  docs/superpowers/plans/2026-06-21-purchase-catalog-latin-fuzzy-search.md \
  scripts/test-purchase-catalog-search.ts \
  lib/purchaseLedger/catalog.ts \
  package.json \
  package-lock.json
git commit -m "feat: add fuzzy purchase catalog search"
```
