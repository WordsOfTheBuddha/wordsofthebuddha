import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_DIR = path.join(__dirname, '../.progress');

/**
 * Ensures the progress directory exists
 */
function ensureProgressDir() {
  if (!fs.existsSync(PROGRESS_DIR)) {
    fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  }
}

/**
 * Gets the path to the progress file for a sutta
 * @param {string} suttaId - The sutta ID
 * @returns {string} Path to the progress file
 */
function getProgressFilePath(suttaId) {
  ensureProgressDir();
  return path.join(PROGRESS_DIR, `${suttaId}.json`);
}

/**
 * Checks the translation progress for a sutta
 * @param {string} suttaId - The sutta ID
 * @param {number} totalParagraphs - Total number of paragraphs
 * @returns {Object} Progress information
 */
export function checkProgress(suttaId, totalParagraphs) {
  const progressPath = getProgressFilePath(suttaId);
  
  if (!fs.existsSync(progressPath)) {
    return {
      completed: 0,
      total: totalParagraphs,
      lastUpdated: null,
    };
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
    return {
      completed: data.completed || 0,
      total: totalParagraphs,
      lastUpdated: data.lastUpdated || null,
    };
  } catch (error) {
    console.error(`Error reading progress file: ${error.message}`);
    return {
      completed: 0,
      total: totalParagraphs,
      lastUpdated: null,
    };
  }
}

/**
 * Saves the translation progress for a sutta
 * @param {string} suttaId - The sutta ID
 * @param {number} completed - Number of completed paragraphs
 * @param {number} total - Total number of paragraphs
 * @returns {boolean} True if saved successfully
 */
export function saveProgress(suttaId, completed, total) {
  const progressPath = getProgressFilePath(suttaId);
  
  try {
    const data = {
      completed,
      total,
      lastUpdated: new Date().toISOString(),
    };
    
    fs.writeFileSync(progressPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error saving progress: ${error.message}`);
    return false;
  }
}