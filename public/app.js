document.addEventListener('DOMContentLoaded', () => {
    // מצב המשחק
    const gameState = {
      images: [],
      currentIndex: 0,
      correctGuesses: 0,
      totalAttempts: 0,
      arabCorrect: 0,
      arabTotal: 0,
      mizrahiCorrect: 0,
      mizrahiTotal: 0,
      isProcessingGuess: false,  // משתנה שמצביע אם יש ניחוש בתהליך
      failedImageAttempts: 0     // מונה לניסיונות שנכשלו ברצף
    };
  
    // מרכיבי ממשק המשתמש
    const elements = {
      loading: document.getElementById('loading'),
      gameContainer: document.getElementById('game-container'),
      gameComplete: document.getElementById('game-complete'),
      currentImage: document.getElementById('current-image'),
      resultOverlay: document.getElementById('result-overlay'),
      btnArab: document.getElementById('btn-arab'),
      btnMizrahi: document.getElementById('btn-mizrahi'),
      correctCount: document.getElementById('correct-count'),
      totalCount: document.getElementById('total-count'),
      progressFill: document.getElementById('progress-fill'),
      sourceLink: document.getElementById('source-link'),
      finalScore: document.getElementById('final-score'),
      finalMessage: document.getElementById('final-message'),
      playAgain: document.getElementById('play-again'),
      successRate: document.getElementById('success-rate'),
      arabSuccessRate: document.getElementById('arab-success-rate'),
      mizrahiSuccessRate: document.getElementById('mizrahi-success-rate')
    };
  
    // טעינת תמונות היום מהשרת
    async function fetchDailyImages() {
      try {
        const response = await fetch('/api/daily-images');
        if (!response.ok) {
          throw new Error('שגיאה בטעינת התמונות');
        }
        const data = await response.json();
        gameState.images = data.images;
        
        elements.loading.style.display = 'none';
        elements.gameContainer.style.display = 'block';
        
        // התחלת המשחק
        startGame();
      } catch (error) {
        console.error('Error fetching images:', error);
        elements.loading.textContent = 'אירעה שגיאה בטעינת התמונות. אנא רענן את הדף.';
      }
    }
  
    // התחלת המשחק
    function startGame() {
      // איפוס מצב המשחק
      gameState.currentIndex = 0;
      gameState.correctGuesses = 0;
      gameState.totalAttempts = 0;
      gameState.arabCorrect = 0;
      gameState.arabTotal = 0;
      gameState.mizrahiCorrect = 0;
      gameState.mizrahiTotal = 0;
      gameState.failedImageAttempts = 0;
      
      // עדכון ממשק
      updateScoreDisplay();
      loadCurrentImage();
    }
  
    // טעינת התמונה הנוכחית
    function loadCurrentImage() {
      if (gameState.currentIndex >= gameState.images.length) {
        endGame();
        // איפוס מצב הכפתורים בסוף המשחק
        gameState.isProcessingGuess = false;
        elements.btnArab.disabled = false;
        elements.btnMizrahi.disabled = false;
        elements.btnArab.classList.remove('btn-disabled');
        elements.btnMizrahi.classList.remove('btn-disabled');
        return;
      }
      
      const currentImage = gameState.images[gameState.currentIndex];
      
      // בדיקה אם היו יותר מדי ניסיונות שנכשלו ברצף
      if (gameState.failedImageAttempts > 5) {
        // מציג הודעת שגיאה מתאימה
        console.error('Too many failed image loads in a row, moving to end game');
        gameState.failedImageAttempts = 0; // איפוס המונה
        endGame();
        return;
      }

      // הוספת מאזין "onerror" לטיפול בכישלון טעינת תמונה
      elements.currentImage.onerror = function() {
        console.error(`Failed to load image: ${currentImage.imageUrl}`);
        gameState.failedImageAttempts++; // להגדיל את מונה הניסיונות שנכשלו
        
        // הצגת מחוון שגיאה
        showImageError();
        
        // נסה לעבור לתמונה הבאה אחרי 1.5 שניות
        setTimeout(() => {
          gameState.currentIndex++;
          loadCurrentImage();
        }, 1500);
      };

      // הוספת מאזין "onload" לאיפוס מונה הניסיונות שנכשלו
      elements.currentImage.onload = function() {
        // איפוס מונה הניסיונות שנכשלו כאשר תמונה נטענת בהצלחה
        gameState.failedImageAttempts = 0;
        
        // הסרת מחוון שגיאה אם קיים
        clearImageError();
      };
      
      elements.currentImage.src = currentImage.imageUrl;
      elements.sourceLink.href = currentImage.sourceUrl;
      
      // הסרת הסטטוס הקודם
      elements.resultOverlay.classList.remove('show', 'correct', 'incorrect');
    }

    // הצגת שגיאת טעינת תמונה
    function showImageError() {
      // בדיקה אם כבר קיים אלמנט שגיאה
      if (document.querySelector('.image-error')) {
        return;
      }
      
      // יצירת אלמנט שגיאה
      const errorDiv = document.createElement('div');
      errorDiv.className = 'image-error';
      errorDiv.innerHTML = '<div>שגיאה בטעינת התמונה</div><div>עובר לתמונה הבאה...</div>';
      
      // הוספת האלמנט למיכל התמונה
      document.querySelector('.image-container').appendChild(errorDiv);
    }

    // הסרת מחוון שגיאת תמונה
    function clearImageError() {
      const errorElement = document.querySelector('.image-error');
      if (errorElement) {
        errorElement.remove();
      }
    }
  
    // בדיקת ניחוש
    function checkGuess(guess) {
      // אם יש כבר ניחוש בעיבוד, נצא מהפונקציה
      if (gameState.isProcessingGuess) {
        return;
      }
      
      // מציינים שהתחלנו לעבד ניחוש
      gameState.isProcessingGuess = true;
      
      // השבתת הכפתורים חזותית ופונקציונלית
      elements.btnArab.disabled = true;
      elements.btnMizrahi.disabled = true;
      elements.btnArab.classList.add('btn-disabled');
      elements.btnMizrahi.classList.add('btn-disabled');
      
      const currentImage = gameState.images[gameState.currentIndex];
      const correct = guess === currentImage.group;
      
      // עדכון סטטיסטיקה
      gameState.totalAttempts++;
      
      if (correct) {
        gameState.correctGuesses++;
        
        if (currentImage.group === 'arab') {
          gameState.arabCorrect++;
        } else {
          gameState.mizrahiCorrect++;
        }
      }
      
      if (currentImage.group === 'arab') {
        gameState.arabTotal++;
      } else {
        gameState.mizrahiTotal++;
      }
      
      // עדכון ממשק
      showResultOverlay(correct);
      updateScoreDisplay();
      
      // שליחת הניחוש לשרת
      logGuessToServer(currentImage, guess, correct);
      
      // מעבר לתמונה הבאה אחרי השהייה קצרה
      setTimeout(() => {
        gameState.currentIndex++;
        loadCurrentImage();
        
        // מאפשרים ניחושים חדשים ומסירים את ההשבתה מהכפתורים
        gameState.isProcessingGuess = false;
        elements.btnArab.disabled = false;
        elements.btnMizrahi.disabled = false;
        elements.btnArab.classList.remove('btn-disabled');
        elements.btnMizrahi.classList.remove('btn-disabled');
      }, 1500);
    }
  
    // הצגת תוצאת ניחוש
    function showResultOverlay(correct) {
      const currentImage = gameState.images[gameState.currentIndex];
      elements.resultOverlay.textContent = correct ? 'צדקת!' : `טעית! זהו ${currentImage.group === 'arab' ? 'ערבי' : 'מזרחי'}`;
      elements.resultOverlay.classList.add('show');
      elements.resultOverlay.classList.add(correct ? 'correct' : 'incorrect');
    }
  
    // עדכון תצוגת ניקוד
    function updateScoreDisplay() {
      elements.correctCount.textContent = gameState.correctGuesses;
      elements.totalCount.textContent = gameState.totalAttempts;
      
      const progressPercentage = (gameState.totalAttempts / gameState.images.length) * 100;
      elements.progressFill.style.width = `${progressPercentage}%`;
      
      // עדכון סטטיסטיקות
      const successRate = gameState.totalAttempts > 0 
        ? Math.round((gameState.correctGuesses / gameState.totalAttempts) * 100) 
        : 0;
        
      const arabSuccessRate = gameState.arabTotal > 0 
        ? Math.round((gameState.arabCorrect / gameState.arabTotal) * 100) 
        : 0;
        
      const mizrahiSuccessRate = gameState.mizrahiTotal > 0 
        ? Math.round((gameState.mizrahiCorrect / gameState.mizrahiTotal) * 100) 
        : 0;
      
      elements.successRate.textContent = `${successRate}%`;
      elements.arabSuccessRate.textContent = `${arabSuccessRate}%`;
      elements.mizrahiSuccessRate.textContent = `${mizrahiSuccessRate}%`;
    }
  
    // שליחת ניחוש לשרת
    async function logGuessToServer(image, guess, correct) {
      try {
        await fetch('/api/log-guess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageId: image.title,
            guess,
            correct
          })
        });
      } catch (error) {
        console.error('Error logging guess:', error);
      }
    }
  
    // סיום המשחק
    function endGame() {
      elements.gameContainer.style.display = 'none';
      elements.gameComplete.style.display = 'block';
      
      const successRate = gameState.totalAttempts > 0 
        ? Math.round((gameState.correctGuesses / gameState.totalAttempts) * 100) 
        : 0;
      
      elements.finalScore.textContent = `הצלחת ב-${gameState.correctGuesses} מתוך ${gameState.totalAttempts} תמונות (${successRate}%)`;
      
      let message = '';
      if (successRate >= 90) {
        message = 'מרשים! יש לך יכולת מעולה להבחין בין קבוצות אתניות!';
      } else if (successRate >= 70) {
        message = 'כל הכבוד! תוצאה טובה מאוד!';
      } else if (successRate >= 50) {
        message = 'לא רע, אך יש מקום לשיפור. נסה שוב מחר!';
      } else {
        message = 'זה לא קל להבחין בין קבוצות אתניות, נכון? נסה שוב מחר!';
      }
      
      elements.finalMessage.textContent = message;
    }
  
    // אירועי לחצנים
    elements.btnArab.addEventListener('click', () => checkGuess('arab'));
    elements.btnMizrahi.addEventListener('click', () => checkGuess('mizrahi'));
    elements.playAgain.addEventListener('click', () => {
      elements.gameComplete.style.display = 'none';
      elements.gameContainer.style.display = 'block';
      startGame();
    });
  
    // התחלת המשחק עם טעינת הדף
    fetchDailyImages();
  });