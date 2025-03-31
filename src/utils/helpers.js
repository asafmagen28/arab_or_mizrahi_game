/**
 * אוסף פונקציות עזר לשימוש בכל האפליקציה
 */

/**
 * ערבוב מערך בצורה אקראית (באלגוריתם Fisher-Yates)
 * @param {Array} array - המערך לערבוב
 * @returns {Array} - המערך המעורבב
 */
function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  /**
   * יצירת ID ייחודי
   * @param {string} prefix - תחילית לשים לפני המזהה
   * @returns {string} - מזהה ייחודי
   */
  function generateId(prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}${timestamp}_${random}`;
  }
  
  /**
   * הסרת תווים מיוחדים ורווחים מטקסט
   * @param {string} text - הטקסט לניקוי
   * @returns {string} - הטקסט המנוקה
   */
  function cleanText(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\s-_.]/g, '_')
      .replace(/[^\w\u0590-\u05FF]/g, '');
  }
  
  /**
   * המרת תאריך ISO לפורמט תאריך ישראלי
   * @param {string|Date} date - תאריך לעיצוב
   * @returns {string} - תאריך בפורמט ישראלי (DD/MM/YYYY)
   */
  function formatDateHebrew(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }
  
  /**
   * בדיקה אם טקסט מכיל אותיות בעברית
   * @param {string} text - טקסט לבדיקה
   * @returns {boolean} - האם הטקסט מכיל אותיות בעברית
   */
  function hasHebrewLetters(text) {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
  }
  
  /**
   * לקיחת חלק אקראי ממערך בגודל מוגדר
   * @param {Array} array - המערך המקורי 
   * @param {number} size - כמות האיברים לקחת
   * @returns {Array} - תת-מערך בגודל המבוקש
   */
  function getRandomSubset(array, size) {
    if (size >= array.length) return [...array];
    const shuffled = shuffleArray(array);
    return shuffled.slice(0, size);
  }
  
  /**
   * חישוב אחוז ההצלחה
   * @param {number} correct - מספר הניחושים הנכונים
   * @param {number} total - מספר הניחושים הכולל
   * @param {number} [decimals=0] - מספר הספרות אחרי הנקודה העשרונית
   * @returns {number} - אחוז ההצלחה
   */
  function calculateSuccessRate(correct, total, decimals = 0) {
    if (total === 0) return 0;
    const rate = (correct / total) * 100;
    return Number(rate.toFixed(decimals));
  }
  
  module.exports = {
    shuffleArray,
    generateId,
    cleanText,
    formatDateHebrew,
    hasHebrewLetters,
    getRandomSubset,
    calculateSuccessRate
  };