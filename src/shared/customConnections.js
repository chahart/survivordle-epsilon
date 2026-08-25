import { saveCustomPuzzleRemote, fetchCustomPuzzleRemote } from "./supabase";

export const CUSTOM_CATEGORY_MAX_LEN = 40;
export const CUSTOM_ITEM_MAX_LEN = 30;
export const CUSTOM_TITLE_MAX_LEN = 60;

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 7;

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// Saves a puzzle to Supabase under a fresh short code and returns that code,
// or null if the save failed (network error, or a fluke code collision that
// didn't resolve after a retry).
export async function createCustomPuzzle(puzzle) {
  const groups = puzzle.groups.map(g => ({ difficulty: g.difficulty, category: g.category, items: g.items }));
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = randomCode();
    const ok = await saveCustomPuzzleRemote({ code, title: puzzle.title || "", groups });
    if (ok) return code;
  }
  return null;
}

// Returns { title, groups } in the same shape ConnectionsGame expects, or
// null if the code doesn't exist / the fetch fails / the stored row is malformed.
export async function loadCustomPuzzle(code) {
  if (!code) return null;
  const row = await fetchCustomPuzzleRemote(code);
  if (!row) return null;
  const puzzle = { title: row.title || "", groups: row.groups };
  if (!isStructurallyValid(puzzle)) return null;
  return puzzle;
}

function isStructurallyValid(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.groups) || puzzle.groups.length !== 4) return false;
  return puzzle.groups.every(g =>
    g && typeof g.category === "string" && g.category.trim() &&
    Array.isArray(g.items) && g.items.length === 4 &&
    g.items.every(item => typeof item === "string" && item.trim()) &&
    [1, 2, 3, 4].includes(g.difficulty)
  );
}

export function getCustomPuzzleUrl(code) {
  return `${window.location.origin}/connections/custom/${code}`;
}

// Validates the raw builder form state before saving.
// formState: { title, groups: [{ category, items: [4 strings] }, x4] }
export function validateCustomPuzzle(formState) {
  const errors = [];
  const groups = formState?.groups || [];

  if (formState?.title && formState.title.length > CUSTOM_TITLE_MAX_LEN) {
    errors.push(`Title must be ${CUSTOM_TITLE_MAX_LEN} characters or fewer.`);
  }

  if (groups.length !== 4) {
    errors.push("You need exactly 4 categories.");
  }

  const allItems = [];
  groups.forEach((g, gi) => {
    const category = (g.category || "").trim();
    if (!category) errors.push(`Category ${gi + 1} needs a name.`);
    else if (category.length > CUSTOM_CATEGORY_MAX_LEN) {
      errors.push(`Category ${gi + 1}'s name must be ${CUSTOM_CATEGORY_MAX_LEN} characters or fewer.`);
    }

    const items = g.items || [];
    if (items.length !== 4) {
      errors.push(`Category ${gi + 1} needs exactly 4 items.`);
    }
    items.forEach((item, ii) => {
      const trimmed = (item || "").trim();
      if (!trimmed) {
        errors.push(`Category ${gi + 1}, item ${ii + 1} is empty.`);
      } else if (trimmed.length > CUSTOM_ITEM_MAX_LEN) {
        errors.push(`Category ${gi + 1}, item ${ii + 1} must be ${CUSTOM_ITEM_MAX_LEN} characters or fewer.`);
      } else {
        allItems.push(trimmed.toLowerCase());
      }
    });
  });

  const seen = new Set();
  for (const item of allItems) {
    if (seen.has(item)) {
      errors.push("Every item across all 4 categories must be unique.");
      break;
    }
    seen.add(item);
  }

  return { valid: errors.length === 0, errors };
}

// Builds the puzzle object (in ConnectionsGame's expected shape) from
// validated form state, ready to pass to createCustomPuzzle.
export function buildPuzzleFromForm(formState) {
  return {
    title: (formState.title || "").trim(),
    groups: formState.groups.map((g, i) => ({
      difficulty: i + 1,
      category: g.category.trim(),
      items: g.items.map(item => item.trim()),
    })),
  };
}
