const wikipediaService = require('./wikipediaService');
const dataService = require('./dataService');
const ApiUtils = require('../utils/apiUtils');
const { shuffleArray } = require('../utils/helpers');

const { 
  arabicLastNames, 
  mizrahiLastNames, 
  wikiCategories, 
  IMAGES_PER_CATEGORY,
  IMAGE_SETTINGS
} = require('../config/constants');

/**
 * שירות לטיפול בתמונות
 */
class ImageService {
  constructor() {
    // מאגר זמני של תמונות היום
    this.todaysImages = [];
  }

  /**
   * פונקציה חדשה לבדיקת רזולוציה ואיכות תמונה
   * @param {string} imageUrl - כתובת URL של התמונה
   * @returns {Promise<{isValid: boolean, width: number, height: number, message: string}>} 
   * - תוצאת הבדיקה עם מידע על הרזולוציה והסיבה לדחייה (אם קיימת)
   */
  async checkImageResolution(imageUrl) {
    try {
      // קריאת מידע מ-URL של התמונה באמצעות regex
      let width = 0;
      let height = 0;
      
      // בדיקת מידע על רזולוציה ב-URL
      // רוב תמונות ויקיפדיה מכילות את הפורמט הבא: /XXXpx-filename.jpg
      const widthMatch = imageUrl.match(/\/([0-9]+)px-/);
      if (widthMatch && widthMatch[1]) {
        width = parseInt(widthMatch[1]);
      }
      
      // בדיקת תבנית אחרת שלפעמים מופיעה ב-thumb URLs
      const thumbMatch = imageUrl.match(/\/thumb\/.*?\/([0-9]+)px-/);
      if (!width && thumbMatch && thumbMatch[1]) {
        width = parseInt(thumbMatch[1]);
      }
      
      // נסה לחלץ גובה אם קיים בשם הקובץ (פחות נפוץ)
      const heightMatch = imageUrl.match(/-x([0-9]+)/);
      if (heightMatch && heightMatch[1]) {
        height = parseInt(heightMatch[1]);
      }
      
      // אם לא הצלחנו לחלץ את הרוחב מה-URL, נחזיר שהתמונה בסדר
      // הסיבה: לא כל ה-URLs מכילים מידע על רזולוציה, ועדיין ייתכן שהתמונה באיכות טובה
      if (width === 0) {
        return { 
          isValid: true, 
          width: 0, 
          height: 0, 
          message: "לא ניתן לקבוע רזולוציה מה-URL, התמונה תיבדק לפי תוכן העמוד" 
        };
      }
      
      // אם יש רק רוחב, נשער את הגובה לפי יחס סטנדרטי של תמונות פנים
      if (height === 0) {
        // יחס של 4:3 מקובל בתמונות פורטרט
        height = Math.round(width * 0.75);
      }
      
      // בדיקת רזולוציה מינימלית
      if (width < IMAGE_SETTINGS.MIN_WIDTH || height < IMAGE_SETTINGS.MIN_HEIGHT) {
        return { 
          isValid: false, 
          width, 
          height, 
          message: `תמונה קטנה מדי (${width}x${height}), מינימום נדרש: ${IMAGE_SETTINGS.MIN_WIDTH}x${IMAGE_SETTINGS.MIN_HEIGHT}` 
        };
      }
      
      // בדיקת יחס תצוגה
      const aspectRatio = height / width;
      if (aspectRatio < IMAGE_SETTINGS.ASPECT_RATIO_MIN || aspectRatio > IMAGE_SETTINGS.ASPECT_RATIO_MAX) {
        return { 
          isValid: false, 
          width, 
          height, 
          message: `יחס תצוגה לא מתאים (${aspectRatio.toFixed(2)}), טווח מותר: ${IMAGE_SETTINGS.ASPECT_RATIO_MIN}-${IMAGE_SETTINGS.ASPECT_RATIO_MAX}` 
        };
      }
      
      // אם התמונה בסדר אך קטנה מהמינימום המועדף, נחזיר אזהרה
      if (width < IMAGE_SETTINGS.PREFERRED_MIN_WIDTH || height < IMAGE_SETTINGS.PREFERRED_MIN_HEIGHT) {
        return { 
          isValid: true, 
          width, 
          height, 
          message: `התמונה בסדר אך קטנה מהמועדף (${width}x${height})` 
        };
      }
      
      return { 
        isValid: true, 
        width, 
        height, 
        message: `תמונה תקינה (${width}x${height})` 
      };
    } catch (error) {
      console.error('Error checking image resolution:', error.message);
      return { 
        isValid: true, 
        width: 0, 
        height: 0, 
        message: "שגיאה בבדיקת רזולוציה, מניח שהתמונה תקינה" 
      };
    }
  }

  /**
   * פונקציה לבקשת תמונה גדולה יותר אם התמונה הנוכחית קטנה מדי
   * @param {string} imageUrl - כתובת URL המקורית של התמונה
   * @returns {string} - כתובת URL חדשה עם רזולוציה גבוהה יותר
   */
  getHigherResolutionUrl(imageUrl) {
    try {
      // בדיקה האם מדובר ב-URL של ויקיפדיה עם תבנית של רזולוציה
      const widthMatch = imageUrl.match(/\/([0-9]+)px-/);
      
      if (widthMatch && widthMatch[1]) {
        const currentWidth = parseInt(widthMatch[1]);
        
        // אם הרזולוציה הנוכחית נמוכה מהרצויה, נעלה אותה
        if (currentWidth < IMAGE_SETTINGS.PREFERRED_REQUEST_SIZE) {
          // החלפת רוחב הרזולוציה בגודל המועדף
          return imageUrl.replace(`/${currentWidth}px-`, `/${IMAGE_SETTINGS.PREFERRED_REQUEST_SIZE}px-`);
        }
      }
      
      // אם לא הצלחנו למצוא את תבנית הרזולוציה או שהרזולוציה כבר גבוהה מספיק, נחזיר את ה-URL המקורי
      return imageUrl;
    } catch (error) {
      console.error('Error getting higher resolution URL:', error.message);
      return imageUrl; // במקרה של שגיאה, נחזיר את ה-URL המקורי
    }
  }

/**
 * פונקציה מעודכנת לחיפוש תמונות בוויקיפדיה העברית עם סינון לפי שנת לידה
 * @param {string} searchTerm - מונח החיפוש (שם משפחה או קטגוריה)
 * @param {boolean} isCategory - האם החיפוש הוא לפי קטגוריה
 * @param {number} minBirthYear - שנת לידה מינימלית לסינון (1850 כברירת מחדל)
 * @returns {Promise<Array>} - מערך של אובייקטי תמונות
 */
async fetchImagesFromWikipedia(searchTerm, isCategory = false, minBirthYear = 1850) {
  try {
    console.log(`Searching for ${isCategory ? 'category' : 'term'}: ${searchTerm}, with min birth year: ${minBirthYear}`);
    let pageIds = [];
    
    if (isCategory) {
      // אם זה חיפוש לפי קטגוריה
      pageIds = await wikipediaService.fetchPagesInCategory(searchTerm);
    } else {
      // חיפוש רגיל לפי שם משפחה
      pageIds = await wikipediaService.searchWikipedia(searchTerm);
    }

    if (pageIds.length === 0) {
      console.log(`No pages found for ${searchTerm}`);
      return [];
    }
    
    console.log(`Found ${pageIds.length} pages for ${searchTerm}, checking if they are about humans born after ${minBirthYear}...`);
    
    // בדיקה שהערכים הם על בני אדם שנולדו אחרי השנה המבוקשת
    const humanPageIds = [];
    for (const pageId of pageIds) {
      try {
        const { isHuman, birthYear } = await wikipediaService.isHumanArticleWithBirthYear(pageId, minBirthYear);
        if (isHuman && birthYear && birthYear >= minBirthYear) {
          humanPageIds.push({
            pageId,
            birthYear
          });
          console.log(`Accepted: ${pageId} with birth year ${birthYear}`);
        }
        // השהייה קצרה בין בדיקות - מקוצר ל-200 מילישניות
        await ApiUtils.sleep(200);
      } catch (error) {
        console.error(`Error checking if page ${pageId} is human:`, error.message);
      }
    }
      
    console.log(`Found ${humanPageIds.length} human pages born after ${minBirthYear} out of ${pageIds.length} total for "${searchTerm}"`);
    
    if (humanPageIds.length === 0) {
      return [];
    }

    // קבלת מידע על הדפים כולל תמונות
    // שימוש בגודל טאמבנייל גבוה יותר
    const pageIdsOnly = humanPageIds.map(item => item.pageId);
    const pages = await wikipediaService.getPageInfo(pageIdsOnly, IMAGE_SETTINGS.THUMBNAIL_SIZE);
    
    if (!pages || Object.keys(pages).length === 0) {
      console.log(`No page info found for ${searchTerm}`);
      return [];
    }
    
    const results = [];

    // עיבוד התוצאות
    for (const { pageId, birthYear } of humanPageIds) {
      const page = pages[pageId];
      if (!page) continue;
      
      // ננסה להשתמש בתמונה הראשית (thumbnail) אם קיימת
      if (page.thumbnail && page.thumbnail.source) {
        console.log(`Using main thumbnail for ${page.title}: ${page.thumbnail.source}`);
        
        // שדרוג רזולוציה אם צריך
        const potentiallyHigherResUrl = this.getHigherResolutionUrl(page.thumbnail.source);
        
        // בדיקת רזולוציה בסיסית בלבד
        const resolutionCheck = await this.checkImageResolution(potentiallyHigherResUrl);
        
        if (!resolutionCheck.isValid) {
          console.log(`Skipping image with bad resolution: ${page.title} - ${resolutionCheck.message}`);
          continue;
        }
        
        // קביעת הקבוצה (ערבי או מזרחי) לפי הפרמטרים
        let group;
        if (isCategory) {
          // אם זה חיפוש לפי קטגוריה, הקבוצה נקבעת לפי הקטגוריה
          group = searchTerm.includes('ערבי') ? 'arab' : 'mizrahi';
        } else {
          // אחרת, לפי שם המשפחה
          group = searchTerm === 'מזרחי' ? 'mizrahi' : 
                  arabicLastNames.includes(searchTerm) ? 'arab' : 'mizrahi';
        }
        
        // יצירת אובייקט התמונה
        const imageObject = {
          title: page.title,
          imageUrl: potentiallyHigherResUrl,
          originalUrl: page.thumbnail.source, // שמירת ה-URL המקורי לצורך מעקב
          sourceUrl: page.fullurl || `https://he.wikipedia.org/?curid=${pageId}`,
          group: group,
          id: `${page.title}_${pageId}`, // מזהה ייחודי לתמונה
          width: page.thumbnail.width || 0,
          height: page.thumbnail.height || 0,
          birthYear // שמירת שנת הלידה
        };
        
        try {
          // בדיקה אם התמונה כבר הופיעה בהיסטוריה
          const existsInHistory = dataService.imageExistsInHistory(imageObject.id);
          
          if (!existsInHistory) {
            results.push(imageObject);
          } else {
            console.log(`Image ${imageObject.id} already in history, skipping`);
          }
        } catch (err) {
          console.error('Error checking history:', err);
          // במקרה של שגיאה, נוסיף את התמונה בכל מקרה
          results.push(imageObject);
        }
        
        continue;
      }
      
      // אם אין תמונה ראשית, ננסה למצוא תמונה מתאימה מרשימת התמונות
      if (page.images && page.images.length > 0) {
        // סינון תמונות מתאימות - סינון בסיסי בלבד לפי סיומת קובץ
        const filteredImages = page.images
          .filter(img => img.title && img.title.match(/\.(jpg|jpeg|png)$/i) && 
                !img.title.toLowerCase().includes('logo'));
        
        if (filteredImages.length === 0) {
          console.log(`No suitable images found for ${page.title}`);
          continue;
        }
        
        // לקיחת התמונה הראשונה
        const firstImageTitle = filteredImages[0].title;
        
        try {
          // קבלת כתובת התמונה
          const imageUrl = await wikipediaService.getImageUrl(firstImageTitle);
          
          if (!imageUrl) {
            console.log(`Could not get URL for image ${firstImageTitle}`);
            continue;
          }
          
          // שדרוג רזולוציה אם צריך
          const potentiallyHigherResUrl = this.getHigherResolutionUrl(imageUrl);
          
          // בדיקת רזולוציה בסיסית בלבד
          const resolutionCheck = await this.checkImageResolution(potentiallyHigherResUrl);
          
          if (!resolutionCheck.isValid) {
            console.log(`Skipping image with bad resolution: ${page.title} - ${resolutionCheck.message}`);
            continue;
          }
          
          // קביעת הקבוצה (ערבי או מזרחי) לפי הפרמטרים
          let group;
          if (isCategory) {
            // אם זה חיפוש לפי קטגוריה, הקבוצה נקבעת לפי הקטגוריה
            group = searchTerm.includes('ערבי') ? 'arab' : 'mizrahi';
          } else {
            // אחרת, לפי שם המשפחה
            group = searchTerm === 'מזרחי' ? 'mizrahi' : 
                    arabicLastNames.includes(searchTerm) ? 'arab' : 'mizrahi';
          }
          
          // יצירת אובייקט התמונה
          const imageObject = {
            title: page.title,
            imageUrl: potentiallyHigherResUrl,
            originalUrl: imageUrl, // שמירת ה-URL המקורי לצורך מעקב
            sourceUrl: page.fullurl || `https://he.wikipedia.org/?curid=${pageId}`,
            group: group,
            id: `${page.title}_${pageId}`, // מזהה ייחודי לתמונה
            birthYear // שמירת שנת הלידה
          };
          
          try {
            // בדיקה אם התמונה כבר הופיעה בהיסטוריה
            const existsInHistory = dataService.imageExistsInHistory(imageObject.id);
            
            if (!existsInHistory) {
              results.push(imageObject);
            } else {
              console.log(`Image ${imageObject.id} already in history, skipping`);
            }
          } catch (err) {
            console.error('Error checking history for image from list:', err);
            // במקרה של שגיאה, נוסיף את התמונה בכל מקרה
            results.push(imageObject);
          }
        } catch (error) {
          console.error(`Error getting image for ${page.title}:`, error.message);
        }
      } else {
        console.log(`No images found for ${page.title}`);
      }
    }

    console.log(`Returning ${results.length} images for ${searchTerm}`);
    return results;
  } catch (error) {
    console.error(`Error fetching data for ${searchTerm}:`, error.message);
    return [];
  }
}

  /**
 * פונקציה לחילול מאגר תמונות יומי עם סינון לפי שנת לידה
 * @param {number} minBirthYear - שנת לידה מינימלית לסינון (1850 כברירת מחדל)
 * @returns {Promise<Array>} - מערך של תמונות יומיות
 */
async generateDailyImages(minBirthYear = 1850) {
  console.log(`Generating daily images for people born after ${minBirthYear}...`);
  
  // וידוא שמאגר נטען כראוי
  const existingImages = dataService.loadHistoricalImages();
  
  // שימוש במאגר היסטורי אם יש מספיק תמונות
  if (Array.isArray(existingImages) && existingImages.length >= IMAGES_PER_CATEGORY * 2) {
    console.log(`Using ${existingImages.length} images from historical cache`);
    
    // סינון לפי קבוצה, שנת לידה, ויצירת עותק של המערך למניעת שינויים במקור
    const arabImages = [...existingImages.filter(img => img && img.group === 'arab' && 
      (!minBirthYear || !img.birthYear || img.birthYear >= minBirthYear))];
    const mizrahiImages = [...existingImages.filter(img => img && img.group === 'mizrahi' && 
      (!minBirthYear || !img.birthYear || img.birthYear >= minBirthYear))];
    
    console.log(`Found ${arabImages.length} arab images and ${mizrahiImages.length} mizrahi images in cache matching birth year criteria`);
    
    // רק אם יש מספיק תמונות לכל קבוצה, משתמשים במטמון
    if (arabImages.length >= IMAGES_PER_CATEGORY && mizrahiImages.length >= IMAGES_PER_CATEGORY) {
      // ערבוב התמונות בכל קבוצה
      const randomArabic = arabImages.sort(() => 0.5 - Math.random()).slice(0, IMAGES_PER_CATEGORY);
      const randomMizrahi = mizrahiImages.sort(() => 0.5 - Math.random()).slice(0, IMAGES_PER_CATEGORY);
        
      // ערבוב כללי של התמונות הנבחרות
      this.todaysImages = [...randomArabic, ...randomMizrahi].sort(() => 0.5 - Math.random());
      
      // שמירת התמונות במאגר הקבוע
      await dataService.saveDailyImages(this.todaysImages);
      
      console.log(`Generated ${this.todaysImages.length} daily images from cache`);
      return this.todaysImages;
    } else {
      console.log('Not enough images in each category in cache, fetching new images');
    }
  } else {
    console.log('Not enough images in cache, fetching new images');
  }
  
  // הרחבת מספר שמות המשפחה לחיפוש
  const limitedArabic = shuffleArray(arabicLastNames).slice(0, 15);
  const limitedMizrahi = shuffleArray(mizrahiLastNames).slice(0, 15);
  const limitedArabCategories = wikiCategories.arab.slice(0, 5);
  const limitedMizrahiCategories = wikiCategories.mizrahi.slice(0, 5);
  
  // שליחת הבקשות באופן סדרתי כדי להפחית את העומס
  const arabResults = [];
  const mizrahiResults = [];

  console.log('Fetching Arab names...');
  // חיפוש לפי שמות משפחה ערביים באופן סדרתי
  for (const lastName of limitedArabic) {
    try {
      const results = await this.fetchImagesFromWikipedia(lastName, false, minBirthYear);
      if (results && results.length > 0) {
        console.log(`Found ${results.length} images for ${lastName}`);
        arabResults.push(...results);
        
        // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
        if (arabResults.length >= IMAGES_PER_CATEGORY * 3) {
          break;
        }
      }
      // המתנה קצרה בין בקשות
      await ApiUtils.sleep(500);
    } catch (error) {
      console.error(`Error fetching images for ${lastName}:`, error.message);
    }
  }
  
  console.log('Fetching Mizrahi names...');
  // חיפוש לפי שמות משפחה מזרחיים באופן סדרתי
  for (const lastName of limitedMizrahi) {
    try {
      const results = await this.fetchImagesFromWikipedia(lastName, false, minBirthYear);
      if (results && results.length > 0) {
        console.log(`Found ${results.length} images for ${lastName}`);
        mizrahiResults.push(...results);
        
        // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
        if (mizrahiResults.length >= IMAGES_PER_CATEGORY * 3) {
          break;
        }
      }
      // המתנה קצרה בין בקשות
      await ApiUtils.sleep(500);
    } catch (error) {
      console.error(`Error fetching images for ${lastName}:`, error.message);
    }
  }
  
  // אם אין מספיק תמונות, נחפש גם בקטגוריות
  if (arabResults.length < IMAGES_PER_CATEGORY * 1.5) {
    console.log('Not enough Arab images, fetching categories...');
    for (const category of limitedArabCategories) {
      try {
        const results = await this.fetchImagesFromWikipedia(category, true, minBirthYear);
        if (results && results.length > 0) {
          console.log(`Found ${results.length} images for category ${category}`);
          arabResults.push(...results);
          
          // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
          if (arabResults.length >= IMAGES_PER_CATEGORY * 3) {
            break;
          }
        }
        // המתנה קצרה בין בקשות
        await ApiUtils.sleep(500);
      } catch (error) {
        console.error(`Error fetching images for category ${category}:`, error.message);
      }
    }
  }
  
  if (mizrahiResults.length < IMAGES_PER_CATEGORY * 1.5) {
    console.log('Not enough Mizrahi images, fetching categories...');
    for (const category of limitedMizrahiCategories) {
      try {
        const results = await this.fetchImagesFromWikipedia(category, true, minBirthYear);
        if (results && results.length > 0) {
          console.log(`Found ${results.length} images for category ${category}`);
          mizrahiResults.push(...results);
          
          // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
          if (mizrahiResults.length >= IMAGES_PER_CATEGORY * 3) {
            break;
          }
        }
        // המתנה קצרה בין בקשות
        await ApiUtils.sleep(500);
      } catch (error) {
        console.error(`Error fetching images for category ${category}:`, error.message);
      }
    }
  }
  
  console.log(`Found ${arabResults.length} Arab images and ${mizrahiResults.length} Mizrahi images born after ${minBirthYear}`);

  // שמירת כל התמונות החדשות במאגר ההיסטורי לשימוש בעתיד
  const allNewImages = [...arabResults, ...mizrahiResults];

  // וידוא שיש לנו תמונות מכל קטגוריה
  if (arabResults.length === 0 || mizrahiResults.length === 0) {
    console.log('Missing images from one or more categories, using sample images...');
    // בתרחיש זה, ייתכן שנרצה לנסות שוב עם שנת לידה מוקדמת יותר
    if (minBirthYear > 1800) {
      console.log(`Retrying with earlier birth year: ${minBirthYear - 50}`);
      return this.generateDailyImages(minBirthYear - 50);
    }
    
    this.todaysImages = this.getSampleImages();
    await dataService.saveDailyImages(this.todaysImages);
    return this.todaysImages;
  }

  // בחירת תמונות רנדומליות
  const randomArabic = arabResults
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.min(arabResults.length, IMAGES_PER_CATEGORY));
    
  const randomMizrahi = mizrahiResults
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.min(mizrahiResults.length, IMAGES_PER_CATEGORY));

  // ערבוב התמונות
  this.todaysImages = [...randomArabic, ...randomMizrahi].sort(() => 0.5 - Math.random());

  if (this.todaysImages.length > 0) {
    try {
      await dataService.updateHistoricalImages(allNewImages);
    } catch (error) {
      console.error('Error updating historical images:', error);
    }
  }
  
  // שמירת התמונות היומיות במאגר הקבוע
  try {
    await dataService.saveDailyImages(this.todaysImages);
    console.log(`Generated ${this.todaysImages.length} daily images born after ${minBirthYear}`);
  } catch (error) {
    console.error('Error saving daily images:', error);
    
    // במקרה של שגיאה, נשתמש בדוגמאות קבועות
    this.todaysImages = this.getSampleImages();
    await dataService.saveDailyImages(this.todaysImages);
  }
  
  return this.todaysImages;
}

  /**
   * פונקציה לקבלת התמונות היומיות
   * @returns {Array} - מערך של תמונות יומיות
   */
  getDailyImages() {
    // אם אין תמונות בזיכרון, ננסה לטעון מהקובץ
    if (!this.todaysImages || this.todaysImages.length === 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const dailyImagesPath = path.join(__dirname, '../../public/daily-images.json');
        
        if (fs.existsSync(dailyImagesPath)) {
          const dailyImagesData = fs.readFileSync(dailyImagesPath, 'utf8');
          const dailyImages = JSON.parse(dailyImagesData);
          
          if (dailyImages && dailyImages.images && dailyImages.images.length > 0) {
            this.todaysImages = dailyImages.images;
            console.log(`Loaded ${this.todaysImages.length} images from daily-images.json`);
          }
        }
      } catch (error) {
        console.error('Error loading daily images from file:', error);
      }
      
      // אם עדיין אין תמונות, נשתמש בדוגמאות קבועות
      if (!this.todaysImages || this.todaysImages.length === 0) {
        this.todaysImages = this.getSampleImages();
      }
    }
    
    return this.todaysImages;
  }

  /**
   * מחזיר תמונות דוגמה במקרה שכל הניסיונות להשיג תמונות מויקיפדיה נכשלים
   * @returns {Array} מערך של תמונות דוגמה
   */
  getSampleImages() {
    return [
      {
        id: 'sample_arab_1',
        title: 'אחמד טיבי',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ahmad_Tibi.jpg/250px-Ahmad_Tibi.jpg',
        sourceUrl: 'https://he.wikipedia.org/wiki/%D7%90%D7%97%D7%9E%D7%93_%D7%98%D7%99%D7%91%D7%99',
        group: 'arab'
      },
      {
        id: 'sample_arab_2',
        title: 'איימן עודה',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Ayman_Odeh_2015.jpg/250px-Ayman_Odeh_2015.jpg',
        sourceUrl: 'https://he.wikipedia.org/wiki/%D7%90%D7%99%D7%99%D7%9E%D7%9F_%D7%A2%D7%95%D7%93%D7%94',
        group: 'arab'
      },
      {
        id: 'sample_mizrahi_1',
        title: 'אמיר פרץ',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Amir_Peretz_2019.jpg/250px-Amir_Peretz_2019.jpg',
        sourceUrl: 'https://he.wikipedia.org/wiki/%D7%90%D7%9E%D7%99%D7%A8_%D7%A4%D7%A8%D7%A5',
        group: 'mizrahi'
      },
      {
        id: 'sample_mizrahi_2',
        title: 'אריה דרעי',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Aryeh_Deri_2021.jpg/250px-Aryeh_Deri_2021.jpg',
        sourceUrl: 'https://he.wikipedia.org/wiki/%D7%90%D7%A8%D7%99%D7%94_%D7%93%D7%A8%D7%A2%D7%99',
        group: 'mizrahi'
      }
    ];
  }
}

module.exports = new ImageService();