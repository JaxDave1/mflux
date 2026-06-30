import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import * as ts from "typescript";

const source = readFileSync(new URL("../src/lib/gallerySelection.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
});
const module = { exports: {} };
vm.runInNewContext(outputText, { module, exports: module.exports, Set });

const {
  firstGallerySelectionItem,
  rangeGallerySelectionIds,
  selectGalleryItems,
  selectGalleryPage,
  selectedGalleryItems,
  toggleGallerySelectionId
} = module.exports;

const item = (id) => ({
  id,
  path: `/tmp/${id}.png`,
  prompt: id,
  model: "dev",
  seed: 42,
  createdAt: "2026-06-29T00:00:00Z"
});

test("selectGalleryPage adds visible page items without clearing existing selection", () => {
  const selected = new Set(["older"]);
  const next = selectGalleryPage([item("a"), item("b")], selected);

  assert.deepEqual([...next].sort(), ["a", "b", "older"]);
  assert.deepEqual([...selected], ["older"]);
});

test("selectGalleryItems adds filtered items across pages without clearing existing selection", () => {
  const selected = new Set(["older"]);
  const filteredItems = [item("a"), item("b"), item("c")];
  const next = selectGalleryItems(filteredItems, selected);

  assert.deepEqual([...next].sort(), ["a", "b", "c", "older"]);
  assert.deepEqual([...selected], ["older"]);
});

test("selectedGalleryItems counts selections from the full gallery item list", () => {
  const allItems = [item("a"), item("b"), item("c")];
  const filteredItems = [item("a")];
  const selected = new Set(["a", "c"]);

  assert.deepEqual(
    selectedGalleryItems(allItems, selected).map((entry) => entry.id),
    ["a", "c"]
  );
  assert.deepEqual(
    selectedGalleryItems(filteredItems, selected).map((entry) => entry.id),
    ["a"]
  );
});

test("rangeGallerySelectionIds extends from anchor through target", () => {
  const next = rangeGallerySelectionIds(
    [item("a"), item("b"), item("c"), item("d")],
    "b",
    "d",
    new Set(["older"])
  );

  assert.deepEqual([...next].sort(), ["b", "c", "d", "older"]);
});

test("toggleGallerySelectionId toggles without mutating the input set", () => {
  const selected = new Set(["a"]);
  const added = toggleGallerySelectionId(selected, "b");
  const removed = toggleGallerySelectionId(selected, "a");

  assert.deepEqual([...selected], ["a"]);
  assert.deepEqual([...added].sort(), ["a", "b"]);
  assert.deepEqual([...removed], []);
});

test("firstGallerySelectionItem follows full gallery order", () => {
  const allItems = [item("a"), item("b"), item("c")];
  const selected = new Set(["c", "b"]);

  assert.equal(firstGallerySelectionItem(allItems, selected)?.id, "b");
});
