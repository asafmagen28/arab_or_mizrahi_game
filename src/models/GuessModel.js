/**
 * מודל המתאר ניחוש במערכת
 */
class GuessModel {
    /**
     * יוצר מופע חדש של ניחוש
     * @param {string} imageId - מזהה התמונה שעליה הניחוש
     * @param {string} guess - ניחוש המשתמש ('arab' או 'mizrahi')
     * @param {boolean} correct - האם הניחוש נכון
     * @param {string} [userId] - מזהה המשתמש (אופציונלי)
     */
    constructor(imageId, guess, correct, userId = null) {
      this.imageId = imageId;
      this.guess = guess;
      this.correct = correct;
      this.userId = userId;
      this.timestamp = new Date();
      this.id = `guess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  
    /**
     * יוצר אובייקט ניחוש מאובייקט JSON
     * @param {Object} data - אובייקט נתונים של ניחוש
     * @returns {GuessModel} - מופע של מודל ניחוש
     */
    static fromJSON(data) {
      const guess = new GuessModel(
        data.imageId,
        data.guess,
        data.correct,
        data.userId || null
      );
      
      // אם יש חותמת זמן ספציפית, השתמש בה
      if (data.timestamp) {
        guess.timestamp = new Date(data.timestamp);
      }
      
      // אם יש מזהה ספציפי, השתמש בו
      if (data.id) {
        guess.id = data.id;
      }
      
      return guess;
    }
  
    /**
     * המרת הניחוש לאובייקט JSON
     * @returns {Object} - תצוגת JSON של הניחוש
     */
    toJSON() {
      return {
        id: this.id,
        imageId: this.imageId,
        guess: this.guess,
        correct: this.correct,
        userId: this.userId,
        timestamp: this.timestamp.toISOString()
      };
    }
    
    /**
     * המרת הניחוש לפורמט CSV
     * @returns {string} - שורת CSV המתאימה לניחוש
     */
    toCSV() {
      return `${this.timestamp.toISOString()},${this.imageId},${this.guess},${this.correct},${this.userId || 'anonymous'}\n`;
    }
  }
  
  module.exports = GuessModel;