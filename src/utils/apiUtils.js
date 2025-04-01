const axios = require('axios');
const https = require('https');

/**
 * מעטפת לביצוע בקשות API עם ניסיון חוזר
 */
class ApiUtils {
  /**
   * ביצוע בקשת API עם ניסיון חוזר במקרה של כישלון
   * @param {Function} apiCallFn - פונקציה שמבצעת את בקשת ה-API
   * @param {number} maxRetries - מספר מקסימלי של ניסיונות חוזרים
   * @param {number} delay - השהייה בין ניסיונות חוזרים (במילישניות)
   * @returns {Promise<any>} - תוצאת בקשת ה-API
   */
  static async withRetry(apiCallFn, maxRetries = 3, delay = 1000) {
    let retries = 0;
    let lastError;

    while (retries <= maxRetries) {
      try {
        return await apiCallFn();
      } catch (error) {
        lastError = error;
        
        // רק סוגי שגיאות מסוימים מצדיקים ניסיון חוזר
        const shouldRetry = this.isRetryableError(error);
        
        if (!shouldRetry || retries >= maxRetries) {
          break;
        }
        
        retries++;
        console.log(`API call failed (attempt ${retries}/${maxRetries}), retrying in ${delay}ms...`);
        console.log(`Error: ${error.message}`);
        
        // המתנה לפני ניסיון חוזר
        await this.sleep(delay);
        
        // הגדלת ההשהייה בכל ניסיון (backoff אקספוננציאלי)
        delay *= 1.5;
      }
    }

    // כל הניסיונות נכשלו
    throw lastError;
  }

  /**
   * בדיקה אם השגיאה מצדיקה ניסיון חוזר
   * @param {Error} error - אובייקט השגיאה
   * @returns {boolean} - האם לנסות שוב
   */
  static isRetryableError(error) {
    // נוסיף סוגי שגיאות רשת שמצדיקות ניסיון חוזר
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNABORTED' || 
        error.code === 'EHOSTUNREACH' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // ניתן גם לנסות שוב במקרה של שגיאות HTTP מסוימות
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // שגיאות שרת (5xx) או שגיאות 429 (יותר מדי בקשות)
      return status >= 500 || status === 429;
    }

    return false;
  }

  /**
   * פונקציית המתנה (sleep)
   * @param {number} ms - זמן המתנה במילישניות
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * יצירת עותק של בקשת axios עם הגדרות שמפחיתות שגיאות תקשורת
   * @param {Object} config - הגדרות מיוחדות
   * @returns {AxiosInstance} - מופע של axios עם הגדרות מותאמות
   */
  static createRobustAxios(config = {}) {
    // הגדרת סוכן HTTPS עם keepAlive והגדרות מותאמות
    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 3000,
      maxSockets: 20, // הגדלה מ-10 ל-20
      timeout: 15000, // הגדלה מ-10000 ל-15000
      rejectUnauthorized: false // במקרה של בעיות SSL
    });

    return axios.create({
      timeout: 20000, // הגדלה מ-15000 ל-20000
      maxContentLength: 20 * 1024 * 1024, // הגדלה מ-10 ל-20 מגה
      maxRedirects: 5, // הגדלה מ-3 ל-5
      httpsAgent,
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'application/json',
        'User-Agent': 'Educational-Project/1.0 (https://example.com; contact@example.com)'
      },
      ...config
    });
  }

  /**
   * האטת קצב הבקשות
   * @param {Array} items - פריטים לעיבוד
   * @param {Function} fn - פונקציה לביצוע על כל פריט
   * @param {number} delayMs - השהייה בין פעולות
   * @param {number} batchSize - גודל קבוצת עיבוד
   * @returns {Promise<Array>} - מערך תוצאות
   */
  static async throttledMap(items, fn, delayMs = 1000, batchSize = 5) { // הגדלה מ-3 ל-5
    const results = [];
    
    // עיבוד בקבוצות
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // עיבוד כל פריט בקבוצה במקביל
      const batchResults = await Promise.all(
        batch.map(item => fn(item))
      );
      
      results.push(...batchResults);
      
      // המתנה בין קבוצות
      if (i + batchSize < items.length) {
        await this.sleep(delayMs);
      }
    }
    
    return results;
  }
}

module.exports = ApiUtils;