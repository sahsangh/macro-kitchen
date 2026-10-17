/**
 * Approximate density (grams per ml) so liquids can be entered in ml.
 * Matched against the food name, first match wins; anything else is treated
 * like water (1 g/ml), which is close enough for milk, juice, broth, etc.
 */
const RULES = [
  [/\b(honey)\b/, 1.42],
  [/\b(molasses|corn syrup|golden syrup)\b/, 1.4],
  [/\b(maple syrup|agave|syrup)\b/, 1.33],
  [/\b(condensed milk)\b/, 1.3],
  [/\b(soy sauce|tamari|fish sauce)\b/, 1.15],
  [/\b(ketchup|bbq sauce|barbecue sauce)\b/, 1.14],
  [/\b(peanut butter|almond butter|nut butter|tahini)\b/, 1.08],
  [/\b(oil|ghee|melted butter)\b/, 0.92],
  [/\b(heavy cream|whipping cream|double cream)\b/, 0.99],
  [/\b(alcohol|vodka|whiskey|rum|gin|tequila|liquor)\b/, 0.95],
  [/\b(yogurt|yoghurt|kefir|sour cream)\b/, 1.04],
  [/\b(juice|soda|cola|lemonade|smoothie)\b/, 1.04],
  [/\b(milk)\b/, 1.03],
];

export function guessDensity(name = '') {
  const n = name.toLowerCase();
  for (const [re, d] of RULES) if (re.test(n)) return d;
  return 1;
}
