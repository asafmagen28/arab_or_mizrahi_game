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
   * @returns {Array} - מערך של תמונות היסטוריות
   */
  loadHistoricalImages() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const historyData = fs.readFileSync(this.historyFilePath, 'utf8');
        try {
          const histImages = JSON.parse(historyData);
          if (Array.isArray(histImages)) {
            this.historicalImages = histImages;
            console.log(`Loaded ${this.historicalImages.length} historical images`);
            return this.historicalImages;
          } else {
            console.error('Historical images data is not an array, initializing empty array');
            this.historicalImages = [];
          }
        } catch (parseError) {
          console.error('Error parsing historical images JSON:', parseError);
          this.historicalImages = [];
        }
      } else {
        console.log('Historical images file does not exist, initializing empty array');
        this.historicalImages = [];
        // יצירת קובץ ריק אם לא קיים
        fs.writeFileSync(this.historyFilePath, '[]');
      }
    } catch (error) {
      console.error('Error loading historical images:', error);
      this.historicalImages = [];
    }
    return this.historicalImages;
  }

  /**
   * בדיקה אם תמונה קיימת במאגר ההיסטורי
   * @param {string} imageId - מזהה התמונה
   * @returns {boolean} - האם התמונה קיימת במאגר
   */
  imageExistsInHistory(imageId) {
    if (!Array.isArray(this.historicalImages)) {
      console.error('Historical images is not an array:', this.historicalImages);
      return false;
    }
    return this.historicalImages.some(img => img && img.id === imageId);
  }

  /**
   * עדכון המאגר ההיסטורי
   * @param {Array} newImages - תמונות חדשות להוספה למאגר
   */
  async updateHistoricalImages(newImages) {
    try {
      if (!Array.isArray(this.historicalImages)) {
        console.error('Historical images is not an array before update, initializing empty array');
        this.historicalImages = [];
      }
      
      if (!Array.isArray(newImages)) {
        console.error('New images is not an array:', newImages);
        return;
      }
      
      // הוספה למאגר ההיסטורי
      this.historicalImages = [...this.historicalImages, ...newImages];
      
      // וידוא שכל פריט במערך תקין
      this.historicalImages = this.historicalImages.filter(img => img && typeof img === 'object' && img.id);
      
      // שמירת רק X התמונות האחרונות כדי למנוע קובץ גדול מדי
      if (this.historicalImages.length > MAX_HISTORY_SIZE) {
        // שמירה על 20% מהמאגר הקודם באופן אקראי כדי לשמור על גיוון
        const oldImagesCount = Math.floor(MAX_HISTORY_SIZE * 0.2);
        const oldImages = this.historicalImages
          .slice(0, this.historicalImages.length - newImages.length)
          .sort(() => 0.5 - Math.random())
          .slice(0, oldImagesCount);
        
        // שמירה על כל התמונות החדשות
        const recentImages = this.historicalImages.slice(this.historicalImages.length - newImages.length);
        
        // מיזוג ההיסטורי עם החדש, עד גבול המאגר המקסימלי
        this.historicalImages = [...oldImages, ...recentImages].slice(0, MAX_HISTORY_SIZE);
      }
      
      // שמירת המאגר ההיסטורי
      const historyJson = JSON.stringify(this.historicalImages);
      fs.writeFileSync(this.historyFilePath, historyJson);
      
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
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // שמירת התמונות בקובץ JSON
      const dailyImagesData = JSON.stringify({ 
        date: new Date().toISOString().split('T')[0],
        images: images
      });
      
      fs.writeFileSync(path.join(publicDir, 'daily-images.json'), dailyImagesData);
      
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
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // הוספת הניחוש לקובץ לוג
      const logEntry = `${new Date().toISOString()},${guessData.imageId},${guessData.guess},${guessData.correct}\n`;
      fs.appendFileSync(path.join(logDir, 'guesses.log'), logEntry);
    } catch (error) {
      console.error('Error logging guess:', error);
    }
  }
}

module.exports = new DataService();