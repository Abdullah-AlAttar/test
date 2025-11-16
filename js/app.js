/**
 * Einbürgerungstest Practice App
 * Main application logic
 */

function app() {
  return {
    version: 'v2.0 - Progress Tracking',
    loading: false,
    voices: [],
    selectedVoiceName: localStorage.getItem('voiceName') || '',
    ttsRate: parseFloat(localStorage.getItem('ttsRate')) || 1,
    ttsPitch: parseFloat(localStorage.getItem('ttsPitch')) || 1,
    categories: [
      { key: 'all', label: '🔀 All Questions (Shuffled)', file: null },
      { key: 'questions_part-1-1-history', label: 'Part 1.1 History', file: 'data/questions_part-1-1-history.json' },
      { key: 'questions_part-1-2-history', label: 'Part 1.2 History', file: 'data/questions_part-1-2-history.json' },
      { key: 'questions_part-2-constitution-holidays-religion', label: 'Part 2 Constitution / Holidays / Religion', file: 'data/questions_part-2-constitution-holidays-religion.json' },
      { key: 'questions_part-3-germany', label: 'Part 3 Germany', file: 'data/questions_part-3-germany.json' },
      { key: 'questions_part-4-1-politics', label: 'Part 4.1 Politics', file: 'data/questions_part-4-1-politics.json' },
      { key: 'questions_part-4-2-politics', label: 'Part 4.2 Politics', file: 'data/questions_part-4-2-politics.json' },
      { key: 'questions_part-5-judiciary-system-and-employment', label: 'Part 5 Judiciary / Employment', file: 'data/questions_part-5-judiciary-system-and-employment.json' },
      { key: 'questions_part-6-1-education-family', label: 'Part 6.1 Education / Family', file: 'data/questions_part-6-1-education-family.json' },
      { key: 'questions_part-6-2-european-union', label: 'Part 6.2 European Union', file: 'data/questions_part-6-2-european-union.json' },
    ],
    selectedCategory: 'all',
    questions: [],
    filteredQuestions: [],
    search: '',
    statusFilter: 'all', // all, new, attempted, mastered
    translationLang: localStorage.getItem('translationLang') || 'english', // english, arabic, both
    answeredCount: 0,
    revealedCount: 0,
    correctCount: 0,
    progressStats: { new: 0, attempted: 0, mastered: 0 },

    /**
     * Fisher-Yates shuffle algorithm
     */
    shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    /**
     * Load questions for selected category
     */
    async loadCategory() {
      const cat = this.categories.find(c => c.key === this.selectedCategory);
      if (!cat) return;
      this.loading = true;
      try {
        if (this.selectedCategory === 'all') {
          // Load all categories
          const allQuestions = [];
          const categoriesToLoad = this.categories.filter(c => c.file !== null);
          for (const category of categoriesToLoad) {
            try {
              const res = await fetch(category.file);
              const raw = await res.json();
              if (Array.isArray(raw)) allQuestions.push(...raw);
            } catch (e) {
              console.error(`Failed to load ${category.file}:`, e);
            }
          }
          const normalized = allQuestions.map(q => this.normalizeQuestion(q));
          this.questions = this.shuffle(normalized);
        } else {
          // Load single category
          const res = await fetch(cat.file);
          const raw = await res.json();
          const normalized = (Array.isArray(raw) ? raw : []).map(q => this.normalizeQuestion(q));
          this.questions = this.shuffle(normalized);
        }
      } catch (e) {
        console.error(e);
        this.questions = [];
      } finally {
        this.loading = false;
        this.applySearch();
        this.recalcStats();
      }
    },

    /**
     * Normalize question data structure
     */
    normalizeQuestion(q) {
      const answers = Array.isArray(q.answers) ? q.answers : [];
      let correct = q.correct_answer;
      if (!correct) {
        const found = answers.find(a => a.is_correct);
        if (found) correct = found.letter;
      }
      const normalizedAnswers = answers.map(a => ({
        letter: a.letter,
        text_german: a.text_german || '',
        text_english: a.text_english || '',
        text_arabic: a.text_arabic || '',
        is_correct: !!a.is_correct
      }));
      const questionData = {
        question_number: q.question_number,
        question_german: q.question_german || '',
        question_english: q.question_english || '',
        question_arabic: q.question_arabic || '',
        answers: this.shuffle(normalizedAnswers),
        correct_answer: correct,
        image_path: q.image_path || null,
        selected: null,
        revealed: false,
        showAll: false,
        progress: null,
        status: 'new'
      };
      
      // Load progress data
      if (q.question_number) {
        questionData.progress = progressTracker.getQuestionProgress(q.question_number);
        questionData.status = progressTracker.getQuestionStatus(q.question_number);
      }
      
      return questionData;
    },

    /**
     * Apply search filter to questions
     */
    applySearch() {
      const term = this.search.trim().toLowerCase();
      let filtered = this.questions;
      
      // Apply text search
      if (term) {
        filtered = filtered.filter(q => {
          const base = [q.question_german, q.question_english, q.question_arabic].join(' ').toLowerCase();
          const answerText = q.answers.map(a => a.text_german + ' ' + a.text_english + ' ' + a.text_arabic).join(' ').toLowerCase();
          return base.includes(term) || answerText.includes(term);
        });
      }
      
      // Apply status filter
      if (this.statusFilter !== 'all') {
        filtered = filtered.filter(q => q.status === this.statusFilter);
      }
      
      this.filteredQuestions = filtered;
      this.updateProgressStats();
    },

    /**
     * Select an answer for a question
     */
    selectAnswer(q, a) {
      if (q.revealed) return; // lock after reveal
      q.selected = a.letter;
      this.recalcStats();
    },

    /**
     * Determine if answer translation should be shown
     */
    showAnswerTranslation(q, a) {
      const hasEnglish = a.text_english && (this.translationLang === 'english' || this.translationLang === 'both');
      const hasArabic = a.text_arabic && (this.translationLang === 'arabic' || this.translationLang === 'both');
      if (!hasEnglish && !hasArabic) return false;
      return q.selected === a.letter || q.showAll;
    },

    /**
     * Reveal the correct answer
     */
    reveal(q) {
      if (q.revealed) return;
      q.revealed = true;
      
      // Record progress if answer was selected
      if (q.selected && q.question_number) {
        const isCorrect = q.selected === q.correct_answer;
        progressTracker.recordAttempt(q.question_number, isCorrect);
        q.progress = progressTracker.getQuestionProgress(q.question_number);
      }
      
      this.recalcStats();
      this.updateProgressStats();
    },

    /**
     * Get feedback text for a revealed question
     */
    feedbackText(q) {
      if (!q.revealed) return '';
      if (!q.selected) return `Correct answer: ${q.correct_answer}`;
      return q.selected === q.correct_answer ? 'Correct ✔️' : `Incorrect ✖️ (Answer: ${q.correct_answer})`;
    },

    /**
     * Get CSS classes for answer styling
     */
    answerClasses(q, a) {
      if (q.revealed) {
        if (a.letter === q.correct_answer) return 'answer correct';
        if (q.selected === a.letter && a.letter !== q.correct_answer) return 'answer incorrect';
        return 'answer';
      }
      if (q.selected === a.letter) return 'answer selected';
      return 'answer';
    },

    /**
     * Normalize image path for display
     */
    normalizeImage(path) {
      if (!path) return '';
      return path.replace(/\\/g, '/');
    },

    /**
     * Recalculate statistics
     */
    recalcStats() {
      this.answeredCount = this.filteredQuestions.filter(q => q.selected).length;
      this.revealedCount = this.filteredQuestions.filter(q => q.revealed).length;
      this.correctCount = this.filteredQuestions.filter(q => q.revealed && q.selected === q.correct_answer).length;
    },

    /**
     * Update progress statistics
     */
    updateProgressStats() {
      const questionNumbers = this.filteredQuestions.map(q => q.question_number).filter(Boolean);
      this.progressStats = progressTracker.getStatsForQuestions(questionNumbers);
    },

    /**
     * Calculate accuracy percentage
     */
    accuracy() {
      if (this.revealedCount === 0) return '0.0';
      return ((this.correctCount / this.revealedCount) * 100).toFixed(1);
    },

    /**
     * Reset session data
     */
    resetSession() {
      this.questions.forEach(q => {
        q.selected = null;
        q.revealed = false;
      });
      this.recalcStats();
    },

    /**
     * Reset all progress data
     */
    resetProgress() {
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        progressTracker.resetAll();
        // Reload to refresh progress indicators
        this.loadCategory();
      }
    },

    /**
     * Get progress badge for question
     */
    getProgressBadge(q) {
      if (!q.progress) return '';
      if (q.status === 'mastered') return '⭐';
      if (q.progress.correct > 0) return '✓';
      if (q.progress.incorrect > 0) return '✗';
      return '';
    },

    /**
     * Get progress tooltip for question
     */
    getProgressTooltip(q) {
      if (!q.progress) return 'New question';
      const p = q.progress;
      return `Attempts: ${p.attempts} | Correct: ${p.correct} | Incorrect: ${p.incorrect}${p.mastered ? ' | MASTERED' : ''}`;
    },

    /**
     * Format question title with number
     */
    formatQuestionTitle(q) {
      const num = q.question_number ?? '?';
      return `<span>${num}. ${escapeHtml(q.question_german)}</span>`;
    },

    /**
     * Initialize app
     */
    init() {
      this.loadCategory();
      this.initVoices();
    },

    /**
     * Change status filter
     */
    changeStatusFilter(filter) {
      this.statusFilter = filter;
      this.applySearch();
    },

    /**
     * Change translation language
     */
    changeTranslationLang(lang) {
      this.translationLang = lang;
      localStorage.setItem('translationLang', lang);
    },

    // ---------------- TTS METHODS ----------------

    /**
     * Initialize text-to-speech voices
     */
    initVoices() {
      if (!('speechSynthesis' in window)) return;
      populateVoices(this);
      window.speechSynthesis.onvoiceschanged = () => populateVoices(this);
    },

    /**
     * Format voice label for display
     */
    voiceLabel(v) {
      return `${v.name} (${v.lang})`;
    },

    /**
     * Store voice preference in localStorage
     */
    storeVoicePreference() {
      localStorage.setItem('voiceName', this.selectedVoiceName);
    },

    /**
     * Store TTS settings in localStorage
     */
    storeTTSSettings() {
      localStorage.setItem('ttsRate', this.ttsRate);
      localStorage.setItem('ttsPitch', this.ttsPitch);
    },

    /**
     * Speak German text using TTS
     */
    speakGerman(text) {
      if (!text) return;
      if (!('speechSynthesis' in window)) {
        alert('Speech synthesis not supported in this browser');
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      const voice = this.voices.find(v => v.name === this.selectedVoiceName) ||
        this.voices.find(v => v.lang.toLowerCase().startsWith('de'));
      if (voice) utter.voice = voice;
      utter.rate = this.ttsRate;
      utter.pitch = this.ttsPitch;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.error(e);
      }
    },

    /**
     * Test voice with sample text
     */
    testVoice() {
      this.speakGerman('Dies ist ein Test für die Sprachausgabe.');
    }
  };
}

// ---------------- HELPER FUNCTIONS ----------------

/**
 * Populate available German voices
 */
function populateVoices(state) {
  const all = speechSynthesis.getVoices();
  state.voices = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('de'));
  if (!state.selectedVoiceName && state.voices.length) {
    state.selectedVoiceName = state.voices[0].name;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Initialize Alpine.js
document.addEventListener('alpine:init', () => {
  Alpine.data('app', app);
});
