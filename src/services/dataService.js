const fs = require('fs');
const path = require('path');
const { 
  HISTORY_FILE_PATH, 
  MAX_HISTORY_SIZE 
} = require('../config/constants');

/**
 * שירות לטיפול ב־I/O של נתונים
 */
class DataService {
  constructor() {
    this.historicalImages = [];
    this.historyFilePath = path.join(__dirname, '../../', HISTORY_FILE_PATH);
    
    // טעינת מאגר היסטורי בעת האתחול
    this.loadHistoricalImages();
  }

  /**
   * טעינת המאגר ההיסטורי
   */
  loadHistoricalImages() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const historyData = fs.readFileSync(this.historyFilePath, 'utf8');
        this.historicalImages = JSON.parse(historyData);
        console.log(`Loaded ${this.historicalImages.length} historical images`);
      }
    } catch (error) {
      console.error('Error loading historical images:', error);
      this.historicalImages = [];
    }
  }

  /**
   * בדיקה אם תמונה קיימת במאגר ההיסטורי
   * @param {string} imageId - מזהה התמונה
   * @returns {boolean} - האם התמונה קיימת במאגר
   */
  imageExistsInHistory(imageId) {
    return this.historicalImages.some(img => img.id === imageId);
  }

  /**
   * עדכון המאגר ההיסטורי
   * @param {Array} newImages - תמונות חדשות להוספה למאגר
   */
  async updateHistoricalImages(newImages) {
    try {
      // הוספה למאגר ההיסטורי
      this.historicalImages = [...this.historicalImages, ...newImages];
      
      // שמירת רק X התמונות האחרונות כדי למנוע קובץ גדול מדי
      if (this.historicalImages.length > MAX_HISTORY_SIZE) {
        this.historicalImages = this.historicalImages.slice(this.historicalImages.length - MAX_HISTORY_SIZE);
      }
      
      // שמירת המאגר ההיסטורי
      await fs.promises.writeFile(
        this.historyFilePath,
        JSON.stringify(this.historicalImages)
      );
      
      console.log(`Updated historical images (${this.historicalImages.length} total)`);
    } catch (error) {
      console.error('Error updating historical images:', error);
    }
  }

  /**
   * שמירת התמונות היומיות בקובץ
   * @param {Array} images - מערך של תמונות יומיות לשמירה
   */
  async saveDailyImages(images) {
    try {
      const publicDir = path.join(__dirname, '../../public');
      
      // וידוא שתיקיית public קיימת
      if (!fs.existsSync(publicDir)) {
        await fs.promises.mkdir(publicDir, { recursive: true });
      }
      
      // שמירת התמונות בקובץ JSON
      await fs.promises.writeFile(
        path.join(publicDir, 'daily-images.json'),
        JSON.stringify({ 
          date: new Date().toISOString().split('T')[0],
          images: images
        })
      );
      
      console.log(`Saved ${images.length} daily images to file`);
    } catch (error) {
      console.error('Error saving daily images:', error);
    }
  }

  /**
   * תיעוד ניחוש משתמש
   * @param {Object} guessData - נתוני הניחוש
   */
  async logGuess(guessData) {
    try {
      // כאן ניתן להוסיף לוגיקה לשמירת הניחושים במסד נתונים
      console.log(`User guessed ${guessData.guess} for image ${guessData.imageId}. Correct: ${guessData.correct}`);
      
      // לדוגמה, אפשר לשמור את הניחושים בקובץ לוג
      const logDir = path.join(__dirname, '../../logs');
      
      // וידוא שתיקיית logs קיימת
      if (!fs.existsSync(logDir)) {
        await fs.promises.mkdir(logDir, { recursive: true });
      }
      
      // הוספת הניחוש לקובץ לוג
      const logEntry = `${new Date().toISOString()},${guessData.imageId},${guessData.guess},${guessData.correct}\n`;
      await fs.promises.appendFile(
        path.join(logDir, 'guesses.log'),
        logEntry
      );
    } catch (error) {
      console.error('Error logging guess:', error);
    }
  }
}

module.exports = new DataService();