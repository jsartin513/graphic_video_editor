/**
 * Demonstration of the Preferences Feature
 * 
 * This script simulates how the preferences feature works in the application.
 * Run with: node DEMO.js
 */

const {
  addRecentPattern,
  formatDate,
  applyDateTokens,
  DEFAULT_PREFERENCES
} = require('./src/preferences');

console.log('════════════════════════════════════════════════════════');
console.log('  Video Merger - Filename Preferences Demo');
console.log('════════════════════════════════════════════════════════\n');

// Simulate user preferences over time
let userPrefs = { ...DEFAULT_PREFERENCES };

console.log('📝 Scenario 1: First-time user renames files\n');
console.log('User enters: "GoPro_Mountain"');
userPrefs = addRecentPattern(userPrefs, 'GoPro_Mountain');
console.log('Saved to recent patterns ✓');
console.log('Recent patterns:', userPrefs.recentFilenamePatterns);
console.log('');

console.log('📝 Scenario 2: User discovers date tokens\n');
console.log('User enters: "Adventure_{date}"');
const testDate = new Date(2024, 0, 15); // Jan 15, 2024
const result1 = applyDateTokens('Adventure_{date}', testDate, 'YYYY-MM-DD');
console.log('After token replacement:', result1);
userPrefs = addRecentPattern(userPrefs, 'Adventure_{date}');
console.log('Saved to recent patterns ✓');
console.log('Recent patterns:', userPrefs.recentFilenamePatterns);
console.log('');

console.log('📝 Scenario 3: User adds more patterns\n');
console.log('User enters: "Session_{year}_{month}"');
const result2 = applyDateTokens('Session_{year}_{month}', testDate);
console.log('After token replacement:', result2);
userPrefs = addRecentPattern(userPrefs, 'Session_{year}_{month}');
console.log('');

console.log('User enters: "GoPro_{year}"');
const result3 = applyDateTokens('GoPro_{year}', testDate);
console.log('After token replacement:', result3);
userPrefs = addRecentPattern(userPrefs, 'GoPro_{year}');
console.log('');

console.log('Recent patterns:', userPrefs.recentFilenamePatterns);
console.log('');

console.log('📝 Scenario 4: User reuses a pattern\n');
console.log('User starts typing "GoPro" and sees suggestions:');
const goProPatterns = userPrefs.recentFilenamePatterns.filter(p => p.includes('GoPro'));
console.log('  Suggestions:', goProPatterns);
console.log('User selects: "GoPro_{year}"');
const result4 = applyDateTokens('GoPro_{year}', testDate);
console.log('After token replacement:', result4);
console.log('Pattern moved to front of list ✓');
userPrefs = addRecentPattern(userPrefs, 'GoPro_{year}');
console.log('Recent patterns:', userPrefs.recentFilenamePatterns);
console.log('');

console.log('📝 Scenario 5: Different date formats\n');
const formats = [
  { name: 'ISO', format: 'YYYY-MM-DD' },
  { name: 'US', format: 'MM-DD-YYYY' },
  { name: 'European', format: 'DD-MM-YYYY' },
  { name: 'Compact', format: 'YYYYMMDD' }
];

console.log('Pattern: "Video_{date}"');
formats.forEach(({ name, format }) => {
  const result = applyDateTokens('Video_{date}', testDate, format);
  console.log(`  ${name} format (${format}): ${result}`);
});
console.log('');

console.log('📝 Scenario 6: Complex patterns\n');
const complexPattern = 'GoPro_Adventure_{year}_{month}_{day}';
console.log(`Pattern: "${complexPattern}"`);
const complexResult = applyDateTokens(complexPattern, testDate);
console.log(`Result: ${complexResult}`);
console.log('');

console.log('════════════════════════════════════════════════════════');
console.log('  Demo completed successfully! ✅');
console.log('════════════════════════════════════════════════════════');
console.log('\nKey Benefits:');
console.log('  ✓ Remembers up to 10 recent patterns');
console.log('  ✓ Auto-completes based on what you type');
console.log('  ✓ Supports flexible date formatting');
console.log('  ✓ Patterns with tokens are reusable');
console.log('  ✓ Most recent patterns appear first');
