# Purchase Catalog Latin Fuzzy Search Design

## Goal

Make the purchase catalog easy to search when staff type Latin letters, even
when they do not know the exact spelling.

Examples:

- `saoxing`, `shaoxing`, or `huadiao` finds `绍兴花雕酒`
- Malay names remain searchable
- A small spelling mistake or transposed letter can still return the intended
  catalog item

## Scope

The enhancement applies to the entire purchase catalog.

Latin-letter queries search:

- the Malay catalog name;
- automatically generated, tone-free pinyin for the Chinese catalog name;
- joined pinyin, spaced pinyin, and pinyin initials;
- fuzzy variants of those Latin search values.

Chinese-character queries keep the current normalized substring behavior.
Chinese fuzzy matching is not part of this change.

## Search and Ranking

Each catalog item receives normalized Latin search values derived at runtime.
The database schema and catalog records do not need new alias columns.

Results are ranked in this order:

1. exact normalized match;
2. prefix match;
3. substring match;
4. fuzzy match within a conservative edit-distance threshold.

Fuzzy matching is enabled only for Latin queries with enough characters to
avoid noisy results. Exact and substring matches remain available for shorter
queries.

The original catalog sequence breaks ties, preserving familiar ordering where
two items have the same match quality.

## Implementation

Extend `lib/purchaseLedger/catalog.ts` so search normalization, pinyin
generation, fuzzy scoring, and ranking remain independent of the UI.

Use a maintained pinyin library for automatic transliteration instead of a
handwritten catalog alias list. Keep the fuzzy-distance implementation small
and local so search behavior is explicit and testable.

`CatalogCombobox` continues to call `filterCatalogItems`; no visual redesign is
required.

## Error Handling and Performance

An empty query returns the original list.

Search values are derived from the in-memory catalog. The catalog is small, so
client-side scoring is sufficient. The implementation must avoid fuzzy
matching for very short queries and reject distant matches.

## Verification

Automated tests will cover:

- `saoxing` finding `绍兴花雕酒`;
- correct `shaoxing` and partial `huadiao` searches;
- Malay exact and partial matching;
- a minor Latin typo;
- pinyin initials;
- Chinese substring matching remaining unchanged;
- unrelated Latin queries returning no result;
- empty queries preserving catalog order.
