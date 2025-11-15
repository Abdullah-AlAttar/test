/**
 * Progress Tracking Module
 * Manages user progress data in localStorage
 */

const PROGRESS_KEY = 'einburgerung_progress';
const MASTERY_THRESHOLD = 2; // Number of correct answers to mark as mastered

/**
 * Progress data structure for each question:
 * {
 *   "question_123": {
 *     "attempts": 3,
 *     "correct": 2,
 *     "incorrect": 1,
 *     "lastAttempt": "2025-11-15T23:24:20.000Z",
 *     "mastered": false
 *   }
 * }
 */

class ProgressTracker {
  constructor() {
    this.data = this.load();
  }

  /**
   * Load progress data from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(PROGRESS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to load progress:', e);
      return {};
    }
  }

  /**
   * Save progress data to localStorage
   */
  save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  }

  /**
   * Get progress for a specific question
   */
  getQuestionProgress(questionNumber) {
    return this.data[`q_${questionNumber}`] || null;
  }

  /**
   * Record an attempt for a question
   */
  recordAttempt(questionNumber, isCorrect) {
    const key = `q_${questionNumber}`;
    if (!this.data[key]) {
      this.data[key] = {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        lastAttempt: null,
        mastered: false,
        firstAttempt: new Date().toISOString()
      };
    }

    const progress = this.data[key];
    progress.attempts++;
    progress.lastAttempt = new Date().toISOString();

    if (isCorrect) {
      progress.correct++;
      // Check if mastered (consecutive correct answers)
      if (progress.correct >= MASTERY_THRESHOLD) {
        progress.mastered = true;
      }
    } else {
      progress.incorrect++;
      // Reset mastery on incorrect answer
      progress.mastered = false;
    }

    this.save();
    return progress;
  }

  /**
   * Get question status (new, attempted, mastered)
   */
  getQuestionStatus(questionNumber) {
    const progress = this.getQuestionProgress(questionNumber);
    if (!progress) return 'new';
    if (progress.mastered) return 'mastered';
    return 'attempted';
  }

  /**
   * Get overall statistics
   */
  getStats() {
    const stats = {
      total: 0,
      new: 0,
      attempted: 0,
      mastered: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      accuracy: 0
    };

    Object.values(this.data).forEach(progress => {
      stats.total++;
      stats.totalAttempts += progress.attempts;
      stats.totalCorrect += progress.correct;
      stats.totalIncorrect += progress.incorrect;
      
      if (progress.mastered) {
        stats.mastered++;
      } else {
        stats.attempted++;
      }
    });

    if (stats.totalAttempts > 0) {
      stats.accuracy = ((stats.totalCorrect / stats.totalAttempts) * 100).toFixed(1);
    }

    return stats;
  }

  /**
   * Get stats for specific question numbers
   */
  getStatsForQuestions(questionNumbers) {
    const stats = {
      total: questionNumbers.length,
      new: 0,
      attempted: 0,
      mastered: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      accuracy: 0
    };

    questionNumbers.forEach(qNum => {
      const progress = this.getQuestionProgress(qNum);
      if (!progress) {
        stats.new++;
      } else {
        stats.totalAttempts += progress.attempts;
        stats.totalCorrect += progress.correct;
        stats.totalIncorrect += progress.incorrect;
        
        if (progress.mastered) {
          stats.mastered++;
        } else {
          stats.attempted++;
        }
      }
    });

    if (stats.totalAttempts > 0) {
      stats.accuracy = ((stats.totalCorrect / stats.totalAttempts) * 100).toFixed(1);
    }

    return stats;
  }

  /**
   * Reset progress for a specific question
   */
  resetQuestion(questionNumber) {
    const key = `q_${questionNumber}`;
    delete this.data[key];
    this.save();
  }

  /**
   * Reset all progress
   */
  resetAll() {
    this.data = {};
    this.save();
  }

  /**
   * Export progress data
   */
  export() {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Import progress data
   */
  import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.data = imported;
      this.save();
      return true;
    } catch (e) {
      console.error('Failed to import progress:', e);
      return false;
    }
  }
}

// Create singleton instance
const progressTracker = new ProgressTracker();
