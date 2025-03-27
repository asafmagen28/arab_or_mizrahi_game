const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

// טעינת שירותים ובקרים
const imageService = require('./services/imageService');
const imagesController = require('./controllers/imagesController');
const guessController = require('./controllers/guessController');

// יצירת אפליקציית Express
const app = express();
const PORT = process.env.PORT || 3000;

// הגדרת middleware בסיסיים
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// הגדרת נתיבי API

// קבלת התמונות היומיות
app.get('/api/daily-images', imagesController.getDailyImages);

// תיעוד ניחושי המשתמשים
app.post('/api/log-guess', (req, res) => guessController.logGuess(req, res));

// פונקציה להתחלת השרת
async function startServer() {
  try {
    // הפעלת החילול הראשוני של התמונות
    await imageService.generateDailyImages();
    
    // תזמון חילול תמונות חדשות בכל יום בחצות
    cron.schedule('0 0 * * *', () => {
      imageService.generateDailyImages()
        .catch(err => console.error('Scheduled image generation failed:', err));
    });
    
    // הפעלת השרת
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// הפעלת השרת
startServer();