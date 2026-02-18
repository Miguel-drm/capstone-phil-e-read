/**
 * Tests for graceful handling of delayed match results
 * 
 * Verifies that position updates process in order even when match results
 * arrive with network delays, preventing position jumping.
 * 
 * **Validates: Requirements 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Simulates the position update logic from ReadingSessionPage.tsx
 * This is the core logic that should handle delayed results gracefully
 */
class PositionTracker {
  private currentPosition: number = 0;
  private positionHistory: number[] = [];
  
  /**
   * Update position based on match result
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2
   * 
   * Gracefully handles delayed match results by preventing backwards position jumps.
   * If a delayed result arrives that would move position backwards, it is ignored.
   */
  updatePosition(matchResult: {
    match_type: string;
    advance: boolean;
    new_position: number;
    miscue_count: number;
  }): void {
    const { advance, new_position } = matchResult;
    
    // Only update position when advance is true
    if (advance && new_position !== undefined) {
      const oldPosition = this.currentPosition;
      
      // Prevent backwards position jumps from delayed results (Requirement 5.2)
      // Only advance if new position is greater than current position
      if (new_position > oldPosition) {
        this.currentPosition = new_position;
        this.positionHistory.push(new_position);
        
        console.log(`Position updated from ${oldPosition} to ${new_position}`);
      } else if (new_position < oldPosition) {
        // Log but don't update - this is a delayed result arriving late
        console.log(`⚠️ Ignoring delayed result: would move position backwards from ${oldPosition} to ${new_position}`);
      } else {
        // new_position === oldPosition - duplicate result, ignore silently
        console.log(`⚠️ Ignoring duplicate result for position ${new_position}`);
      }
    }
  }
  
  getCurrentPosition(): number {
    return this.currentPosition;
  }
  
  getPositionHistory(): number[] {
    return [...this.positionHistory];
  }
  
  reset(): void {
    this.currentPosition = 0;
    this.positionHistory = [];
  }
}

describe('Delayed Match Results Handling', () => {
  let tracker: PositionTracker;
  
  beforeEach(() => {
    tracker = new PositionTracker();
  });
  
  describe('Sequential Processing', () => {
    it('should process match results in order without delays', () => {
      // Simulate sequential match results
      const results = [
        { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 },
        { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0 },
        { match_type: 'correct', advance: true, new_position: 3, miscue_count: 0 },
      ];
      
      results.forEach(result => tracker.updatePosition(result));
      
      // Verify position advanced sequentially
      expect(tracker.getCurrentPosition()).toBe(3);
      expect(tracker.getPositionHistory()).toEqual([1, 2, 3]);
    });
    
    it('should not update position for non-advancing states', () => {
      const results = [
        { match_type: 'buffering', advance: false, new_position: 0, miscue_count: 0 },
        { match_type: 'pending', advance: false, new_position: 0, miscue_count: 0 },
        { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 },
      ];
      
      results.forEach(result => tracker.updatePosition(result));
      
      // Only the last result should update position
      expect(tracker.getCurrentPosition()).toBe(1);
      expect(tracker.getPositionHistory()).toEqual([1]);
    });
  });
  
  describe('Simulated Network Delays', () => {
    it('should handle results arriving in order with delays', async () => {
      // Simulate results arriving with delays but in correct order
      const results = [
        { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0, delay: 10 },
        { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0, delay: 20 },
        { match_type: 'correct', advance: true, new_position: 3, miscue_count: 0, delay: 15 },
      ];
      
      // Process results with simulated delays
      for (const result of results) {
        await new Promise(resolve => setTimeout(resolve, result.delay));
        tracker.updatePosition(result);
      }
      
      // Verify position advanced correctly despite delays
      expect(tracker.getCurrentPosition()).toBe(3);
      expect(tracker.getPositionHistory()).toEqual([1, 2, 3]);
    });
    
    it('should handle results arriving out of order (graceful handling)', async () => {
      // Simulate results arriving out of order due to network delays
      // Result for position 2 arrives before result for position 1
      const results = [
        { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0, delay: 50 },
        { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0, delay: 10 },
        { match_type: 'correct', advance: true, new_position: 3, miscue_count: 0, delay: 20 },
      ];
      
      // Process results in the order they arrive (out of order)
      const sortedResults = [...results].sort((a, b) => a.delay - b.delay);
      
      for (const result of sortedResults) {
        await new Promise(resolve => setTimeout(resolve, result.delay));
        tracker.updatePosition(result);
      }
      
      // New behavior: ignores delayed results that would move position backwards
      // Results arrive in order: position 1 (delay 10), position 3 (delay 20), position 2 (delay 50)
      // Position 2 is ignored because it would move backwards from 3
      expect(tracker.getCurrentPosition()).toBe(3);
      // Position history shows only forward movements: 1, 3 (position 2 was ignored)
      expect(tracker.getPositionHistory()).toEqual([1, 3]);
    });
  });
  
  describe('Position Jumping Prevention', () => {
    it('should not jump backwards when late result arrives', () => {
      // Simulate a late result arriving after newer results
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 });
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 2, miscue_count: 0 });
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 3, miscue_count: 0 });
      
      // Late result for position 2 arrives (should be ignored)
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 2, miscue_count: 0 });
      
      // Position should not jump backwards - stays at 3
      expect(tracker.getCurrentPosition()).toBe(3);
      // Position history should not include the backwards jump
      expect(tracker.getPositionHistory()).toEqual([1, 2, 3]);
    });
    
    it('should handle rapid sequential updates without jumping', () => {
      // Simulate very fast reading (results arriving rapidly)
      const results = Array.from({ length: 10 }, (_, i) => ({
        match_type: 'correct',
        advance: true,
        new_position: i + 1,
        miscue_count: 0
      }));
      
      results.forEach(result => tracker.updatePosition(result));
      
      // Verify position advanced smoothly without jumping
      expect(tracker.getCurrentPosition()).toBe(10);
      expect(tracker.getPositionHistory()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle duplicate results for same position', () => {
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 });
      tracker.updatePosition({ match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 });
      
      // Should ignore duplicate (position doesn't change)
      expect(tracker.getCurrentPosition()).toBe(1);
      // Only first update is recorded
      expect(tracker.getPositionHistory()).toEqual([1]);
    });
    
    it('should handle large position jumps (omissions)', () => {
      // Simulate omission where position jumps by multiple words
      tracker.updatePosition({ match_type: 'omission', advance: true, new_position: 5, miscue_count: 1 });
      
      expect(tracker.getCurrentPosition()).toBe(5);
      expect(tracker.getPositionHistory()).toEqual([5]);
    });
    
    it('should handle mixed advancing and non-advancing results', () => {
      const results = [
        { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0 },
        { match_type: 'buffering', advance: false, new_position: 1, miscue_count: 0 },
        { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0 },
        { match_type: 'pending', advance: false, new_position: 2, miscue_count: 0 },
        { match_type: 'correct', advance: true, new_position: 3, miscue_count: 0 },
      ];
      
      results.forEach(result => tracker.updatePosition(result));
      
      // Only advancing results should update position
      expect(tracker.getCurrentPosition()).toBe(3);
      expect(tracker.getPositionHistory()).toEqual([1, 2, 3]);
    });
  });
  
  describe('Stress Testing', () => {
    it('should handle 100 sequential updates without issues', () => {
      const results = Array.from({ length: 100 }, (_, i) => ({
        match_type: 'correct',
        advance: true,
        new_position: i + 1,
        miscue_count: 0
      }));
      
      results.forEach(result => tracker.updatePosition(result));
      
      expect(tracker.getCurrentPosition()).toBe(100);
      expect(tracker.getPositionHistory().length).toBe(100);
      expect(tracker.getPositionHistory()[0]).toBe(1);
      expect(tracker.getPositionHistory()[99]).toBe(100);
    });
    
    it('should handle rapid updates with mixed types', () => {
      const results = [];
      for (let i = 0; i < 50; i++) {
        results.push({
          match_type: i % 3 === 0 ? 'buffering' : 'correct',
          advance: i % 3 !== 0,
          new_position: Math.floor(i / 3) + 1,
          miscue_count: 0
        });
      }
      
      results.forEach(result => tracker.updatePosition(result));
      
      // With duplicate filtering, only unique advancing positions are counted
      // Calculate expected unique positions
      const uniquePositions = new Set(
        results.filter(r => r.advance).map(r => r.new_position)
      );
      expect(tracker.getPositionHistory().length).toBe(uniquePositions.size);
    });
  });
});

/**
 * Integration test simulating real WebSocket message flow
 */
describe('WebSocket Message Flow Simulation', () => {
  let tracker: PositionTracker;
  
  beforeEach(() => {
    tracker = new PositionTracker();
  });
  
  it('should handle realistic reading session flow', async () => {
    // Simulate a realistic reading session with various match types
    const session = [
      { match_type: 'waiting_for_start', advance: false, new_position: 0, miscue_count: 0, delay: 0 },
      { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0, delay: 500 },
      { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0, delay: 600 },
      { match_type: 'buffering', advance: false, new_position: 2, miscue_count: 0, delay: 100 },
      { match_type: 'mispronunciation', advance: true, new_position: 3, miscue_count: 1, delay: 200 },
      { match_type: 'correct', advance: true, new_position: 4, miscue_count: 0, delay: 550 },
      { match_type: 'substitution', advance: true, new_position: 5, miscue_count: 1, delay: 700 },
      { match_type: 'correct', advance: true, new_position: 6, miscue_count: 0, delay: 500 },
    ];
    
    for (const msg of session) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to simulate async
      tracker.updatePosition(msg);
    }
    
    // Verify final position
    expect(tracker.getCurrentPosition()).toBe(6);
    
    // Verify only advancing results were processed
    const expectedHistory = [1, 2, 3, 4, 5, 6];
    expect(tracker.getPositionHistory()).toEqual(expectedHistory);
  });
  
  it('should handle network jitter (variable delays)', async () => {
    // Simulate network jitter with random delays
    const results = [
      { match_type: 'correct', advance: true, new_position: 1, miscue_count: 0, delay: 50 },
      { match_type: 'correct', advance: true, new_position: 2, miscue_count: 0, delay: 150 },
      { match_type: 'correct', advance: true, new_position: 3, miscue_count: 0, delay: 30 },
      { match_type: 'correct', advance: true, new_position: 4, miscue_count: 0, delay: 200 },
      { match_type: 'correct', advance: true, new_position: 5, miscue_count: 0, delay: 80 },
    ];
    
    // Process with delays
    for (const result of results) {
      await new Promise(resolve => setTimeout(resolve, result.delay));
      tracker.updatePosition(result);
    }
    
    // Despite variable delays, position should advance correctly
    expect(tracker.getCurrentPosition()).toBe(5);
    expect(tracker.getPositionHistory()).toEqual([1, 2, 3, 4, 5]);
  });
});
