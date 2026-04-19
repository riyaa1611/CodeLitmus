export class DifficultyManager {
  private difficulty = 3;
  private consecutiveCorrect = 0;
  private consecutiveWrong = 0;

  getDifficulty(): number {
    return this.difficulty;
  }

  recordAnswer(isCorrect: boolean): void {
    if (isCorrect) {
      this.consecutiveCorrect++;
      this.consecutiveWrong = 0;
      if (this.consecutiveCorrect >= 3) {
        this.difficulty = Math.min(5, this.difficulty + 1);
        this.consecutiveCorrect = 0;
      }
    } else {
      this.consecutiveWrong++;
      this.consecutiveCorrect = 0;
      if (this.consecutiveWrong >= 2) {
        this.difficulty = Math.max(1, this.difficulty - 1);
        this.consecutiveWrong = 0;
      }
    }
  }

  reset(): void {
    this.difficulty = 3;
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
  }

  setDifficulty(n: number): void {
    this.difficulty = Math.max(1, Math.min(5, n));
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
  }
}
