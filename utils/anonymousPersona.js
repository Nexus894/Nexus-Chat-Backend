/**
 * Anonymous Persona Generator
 * Creates a unique, fun identity for anonymous mode
 * Format: [Adjective][Animal][Number] e.g. "CrimsonFox42"
 */

const ADJECTIVES = [
  "Crimson", "Silent", "Neon", "Cosmic", "Shadow", "Electric", "Phantom",
  "Crystal", "Solar", "Lunar", "Atomic", "Mystic", "Blazing", "Frozen",
  "Golden", "Silver", "Amber", "Cobalt", "Violet", "Scarlet",
];

const ANIMALS = [
  "Fox", "Wolf", "Hawk", "Raven", "Lynx", "Viper", "Falcon",
  "Otter", "Panda", "Koala", "Manta", "Gecko", "Hyena", "Bison",
  "Crane", "Dingo", "Egret", "Finch", "Gecko", "Heron",
];

const AURA_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

/**
 * Generates a random anonymous persona
 * @returns {{ name: string, color: string, avatar: string }}
 */
const generateAnonymousPersona = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10–99
  const name = `${adj}${animal}${num}`;

  const color = AURA_COLORS[Math.floor(Math.random() * AURA_COLORS.length)];

  // Use DiceBear for deterministic avatar generation based on the persona name
  const avatar = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${name}&backgroundColor=transparent`;

  return { name, color, avatar };
};

module.exports = { generateAnonymousPersona };
