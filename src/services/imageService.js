const wikipediaService = require('./wikipediaService');
const dataService = require('./dataService');
const ApiUtils = require('../utils/apiUtils');
const { 
  arabicLastNames, 
  mizrahiLastNames, 
  wikiCategories, 
  nonFaceKeywords, 
  faceKeywords,
  IMAGES_PER_CATEGORY 
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
   * פונקציה לבדיקה אם התמונה היא של פנים אנושיות
   * @param {string} imageUrl - כתובת URL של התמונה
   * @returns {Promise<boolean>} - האם התמונה היא של פנים אנושיות
   */
  async isLikelyHumanFace(imageUrl) {
    try {
      // בדיקה בסיסית - האם יש מילים בשם הקובץ שמעידות על אדם
      const lowercaseUrl = imageUrl.toLowerCase();
      
      // בדיקת מילות מפתח לא-אנושיות
      for (const keyword of nonFaceKeywords) {
        if (lowercaseUrl.includes(keyword)) {
          console.log(`Rejected image with non-face keyword: ${keyword} in URL: ${imageUrl}`);
          return false;
        }
      }
      
      // בדיקת גודל ויחס של התמונה
      const sizeMatcher = /\/(\d+)px-/;
      const match = imageUrl.match(sizeMatcher);
      
      if (match) {
        const size = parseInt(match[1]);
        // תמונות קטנות מדי לרוב אינן תמונות פנים טובות - הקטנת הסף מ-100 ל-80
        if (size < 80) {
          console.log(`Rejected small image (${size}px): ${imageUrl}`);
          return false;
        }
      }
      
      // בדיקת מילות מפתח אנושיות
      for (const keyword of faceKeywords) {
        if (lowercaseUrl.includes(keyword)) {
          console.log(`Accepted image with face keyword: ${keyword} in URL: ${imageUrl}`);
          return true;
        }
      }
      
      // אם אין לנו מספיק מידע מהשם, נבדוק את הנתיב המלא
      // תמונות שיש בהן את שם האדם הן לרוב של האדם עצמו
      const filenameRegex = /\/([^\/]+)\.(jpe?g|png)$/i;
      const filenameMatch = imageUrl.match(filenameRegex);
      
      if (filenameMatch) {
        const filename = filenameMatch[1].toLowerCase();
        
        // מילים שסביר שיופיעו בשם קובץ של אדם
        const commonHumanFilenameParts = ['interview', 'speaking', 'portrait', 'official', 'press', 'visit', 'meeting'];
        
        for (const part of commonHumanFilenameParts) {
          if (filename.includes(part)) {
            console.log(`Accepted image with human filename part: ${part} in URL: ${imageUrl}`);
            return true;
          }
        }
        
        // יש סוגי תמונות שלרוב אינן של האדם עצמו
        if (filename.includes('signature') || 
            filename.includes('autograph') || 
            filename.includes('חתימה') ||
            filename.includes('symbol') ||
            filename.includes('logo')) {
          console.log(`Rejected image with non-face filename part in URL: ${imageUrl}`);
          return false;
        }
      }
      
      // אם אין לנו מספיק מידע מהשם, נחזיר true כברירת מחדל - יותר מקל
      console.log(`No clear indicators for image, defaulting to accept: ${imageUrl}`);
      return true;
    } catch (error) {
      console.error('Error checking image for human face:', error.message);
      return true; // במקרה של ספק, נכליל את התמונה
    }
  }

  /**
   * פונקציה לחיפוש תמונות בוויקיפדיה העברית
   * @param {string} searchTerm - מונח החיפוש (שם משפחה או קטגוריה)
   * @param {boolean} isCategory - האם החיפוש הוא לפי קטגוריה
   * @returns {Promise<Array>} - מערך של אובייקטי תמונות
   */
  async fetchImagesFromWikipedia(searchTerm, isCategory = false) {
    try {
      console.log(`Searching for ${isCategory ? 'category' : 'term'}: ${searchTerm}`);
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
      
      console.log(`Found ${pageIds.length} pages for ${searchTerm}, checking if they are about humans...`);
      
      // בדיקה שהערכים הם על בני אדם - מוגבל למספר קטן של בדיקות במקביל
      const humanPageIds = [];
      for (const pageId of pageIds) {
        try {
          const isHuman = await wikipediaService.isHumanArticle(pageId);
          if (isHuman) {
            humanPageIds.push(pageId);
          }
          // השהייה קצרה בין בדיקות - מקוצר ל-200 מילישניות
          await ApiUtils.sleep(200);
        } catch (error) {
          console.error(`Error checking if page ${pageId} is human:`, error.message);
        }
      }
        
      console.log(`Found ${humanPageIds.length} human pages out of ${pageIds.length} total for "${searchTerm}"`);
      
      if (humanPageIds.length === 0) {
        return [];
      }

      // קבלת מידע על הדפים כולל תמונות
      const pages = await wikipediaService.getPageInfo(humanPageIds);
      
      if (!pages || Object.keys(pages).length === 0) {
        console.log(`No page info found for ${searchTerm}`);
        return [];
      }
      
      const results = [];

      // עיבוד התוצאות
      for (const pageId of Object.keys(pages)) {
        const page = pages[pageId];
        
        // ננסה להשתמש בתמונה הראשית (thumbnail) אם קיימת
        if (page.thumbnail && page.thumbnail.source) {
          console.log(`Using main thumbnail for ${page.title}: ${page.thumbnail.source}`);
          
          // בדיקה אם התמונה היא של פנים אנושיות
          const isHumanFace = await this.isLikelyHumanFace(page.thumbnail.source);
          
          if (!isHumanFace) {
            console.log(`Skipping non-human face image: ${page.title}`);
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
            imageUrl: page.thumbnail.source,
            sourceUrl: page.fullurl || `https://he.wikipedia.org/?curid=${pageId}`,
            group: group,
            id: `${page.title}_${pageId}` // מזהה ייחודי לתמונה
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
          // סינון תמונות מתאימות
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
            
            // בדיקה אם התמונה היא של פנים אנושיות
            const isHumanFace = await this.isLikelyHumanFace(imageUrl);
            
            if (!isHumanFace) {
              console.log(`Skipping non-human face image: ${page.title} - ${imageUrl}`);
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
              imageUrl: imageUrl,
              sourceUrl: page.fullurl || `https://he.wikipedia.org/?curid=${pageId}`,
              group: group,
              id: `${page.title}_${pageId}` // מזהה ייחודי לתמונה
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
   * פונקציה לחילול מאגר תמונות יומי
   * @returns {Promise<Array>} - מערך של תמונות יומיות
   */
  async generateDailyImages() {
    console.log('Generating daily images...');
    
    // וידוא שמאגר נטען כראוי
    const existingImages = dataService.loadHistoricalImages();
    
    // שימוש במאגר היסטורי אם יש מספיק תמונות
    if (Array.isArray(existingImages) && existingImages.length >= IMAGES_PER_CATEGORY * 2) {
      console.log(`Using ${existingImages.length} images from historical cache`);
      
      // סינון לפי קבוצה ויצירת עותק של המערך למניעת שינויים במקור
      const arabImages = [...existingImages.filter(img => img && img.group === 'arab')];
      const mizrahiImages = [...existingImages.filter(img => img && img.group === 'mizrahi')];
      
      console.log(`Found ${arabImages.length} arab images and ${mizrahiImages.length} mizrahi images in cache`);
      
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
    const limitedArabic = arabicLastNames.slice(0, 15); // הגדלה מ-5 ל-15
    const limitedMizrahi = mizrahiLastNames.slice(0, 15); // הגדלה מ-5 ל-15
    const limitedArabCategories = wikiCategories.arab.slice(0, 5); // הגדלה מ-2 ל-5
    const limitedMizrahiCategories = wikiCategories.mizrahi.slice(0, 5); // הגדלה מ-2 ל-5
    
    // שליחת הבקשות באופן סדרתי כדי להפחית את העומס
    const arabResults = [];
    const mizrahiResults = [];

    console.log('Fetching Arab names...');
    // חיפוש לפי שמות משפחה ערביים באופן סדרתי
    for (const lastName of limitedArabic) {
      try {
        const results = await this.fetchImagesFromWikipedia(lastName);
        if (results && results.length > 0) {
          console.log(`Found ${results.length} images for ${lastName}`);
          arabResults.push(...results);
          
          // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
          if (arabResults.length >= IMAGES_PER_CATEGORY * 3) {
            break;
          }
        }
        // המתנה קצרה בין בקשות - מקוצר כדי להאיץ
        await ApiUtils.sleep(500);
      } catch (error) {
        console.error(`Error fetching images for ${lastName}:`, error.message);
      }
    }
    
    console.log('Fetching Mizrahi names...');
    // חיפוש לפי שמות משפחה מזרחיים באופן סדרתי
    for (const lastName of limitedMizrahi) {
      try {
        const results = await this.fetchImagesFromWikipedia(lastName);
        if (results && results.length > 0) {
          console.log(`Found ${results.length} images for ${lastName}`);
          mizrahiResults.push(...results);
          
          // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
          if (mizrahiResults.length >= IMAGES_PER_CATEGORY * 3) {
            break;
          }
        }
        // המתנה קצרה בין בקשות - מקוצר כדי להאיץ
        await ApiUtils.sleep(500);
      } catch (error) {
        console.error(`Error fetching images for ${lastName}:`, error.message);
      }
    }
    
    // אם אין מספיק תמונות, נחפש גם בקטגוריות - יותר מקיף
    if (arabResults.length < IMAGES_PER_CATEGORY * 1.5) {
      console.log('Not enough Arab images, fetching categories...');
      for (const category of limitedArabCategories) {
        try {
          const results = await this.fetchImagesFromWikipedia(category, true);
          if (results && results.length > 0) {
            console.log(`Found ${results.length} images for category ${category}`);
            arabResults.push(...results);
            
            // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
            if (arabResults.length >= IMAGES_PER_CATEGORY * 3) {
              break;
            }
          }
          // המתנה קצרה בין בקשות - מקוצר כדי להאיץ
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
          const results = await this.fetchImagesFromWikipedia(category, true);
          if (results && results.length > 0) {
            console.log(`Found ${results.length} images for category ${category}`);
            mizrahiResults.push(...results);
            
            // אם יש כבר הרבה יותר תמונות מהמינימום, לא צריך להמשיך
            if (mizrahiResults.length >= IMAGES_PER_CATEGORY * 3) {
              break;
            }
          }
          // המתנה קצרה בין בקשות - מקוצר כדי להאיץ
          await ApiUtils.sleep(500);
        } catch (error) {
          console.error(`Error fetching images for category ${category}:`, error.message);
        }
      }
    }
    
    console.log(`Found ${arabResults.length} Arab images and ${mizrahiResults.length} Mizrahi images`);

    // שמירת כל התמונות החדשות במאגר ההיסטורי לשימוש בעתיד
    const allNewImages = [...arabResults, ...mizrahiResults];
    if (allNewImages.length > 0) {
      try {
        await dataService.updateHistoricalImages(allNewImages);
      } catch (error) {
        console.error('Error updating historical images:', error);
      }
    }

    // וידוא שיש לנו תמונות מכל קטגוריה
    if (arabResults.length === 0 || mizrahiResults.length === 0) {
      console.log('Missing images from one or more categories, using sample images...');
      this.todaysImages = this.getSampleImages();
      await dataService.saveDailyImages(this.todaysImages);
      return this.todaysImages;
    }

    // בחירת תמונות רנדומליות - תמיד עד 10 (לפי קבוע IMAGES_PER_CATEGORY)
    const randomArabic = arabResults
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(arabResults.length, IMAGES_PER_CATEGORY));
      
    const randomMizrahi = mizrahiResults
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(mizrahiResults.length, IMAGES_PER_CATEGORY));

    // ערבוב התמונות
    this.todaysImages = [...randomArabic, ...randomMizrahi].sort(() => 0.5 - Math.random());
    
    // שמירת התמונות היומיות במאגר הקבוע
    try {
      await dataService.saveDailyImages(this.todaysImages);
      console.log(`Generated ${this.todaysImages.length} daily images`);
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