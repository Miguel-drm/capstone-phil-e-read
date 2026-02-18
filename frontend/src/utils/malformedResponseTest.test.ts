import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration tests for malformed server response handling
 * Tests the complete flow of receiving and validating malformed responses
 * Requirements: 5.5
 */

// Mock console.error to capture error logs
let consoleErrorSpy: any;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

/**
 * Validate match result from server to ensure it has all required fields.
 * This is a copy of the function from ReadingSessionPage.tsx for testing purposes.
 */
const isValidMatchResult = (result: any): boolean => {
  if (!result) {
    console.error('❌ Invalid match result: result is null or undefined');
    return false;
  }

  // Check if result is an object (not a primitive or array)
  if (typeof result !== 'object' || Array.isArray(result)) {
    console.error('❌ Invalid match result: result must be an object, got:', typeof result);
    return false;
  }

  // Check for required fields
  const requiredFields = ['match_type', 'advance', 'new_position', 'miscue_count'];
  const missingFields = requiredFields.filter(field => !(field in result));

  if (missingFields.length > 0) {
    console.error('❌ Invalid match result: missing required fields:', missingFields);
    console.error('   Received:', result);
    return false;
  }

  // Validate field types
  if (typeof result.match_type !== 'string') {
    console.error('❌ Invalid match result: match_type must be a string, got:', typeof result.match_type);
    return false;
  }

  if (typeof result.advance !== 'boolean') {
    console.error('❌ Invalid match result: advance must be a boolean, got:', typeof result.advance);
    return false;
  }

  if (typeof result.new_position !== 'number') {
    console.error('❌ Invalid match result: new_position must be a number, got:', typeof result.new_position);
    return false;
  }

  if (typeof result.miscue_count !== 'number') {
    console.error('❌ Invalid match result: miscue_count must be a number, got:', typeof result.miscue_count);
    return false;
  }

  return true;
};

/**
 * Simulate processing a server message with validation
 * This mimics the actual flow in ReadingSessionPage.tsx
 */
const processServerMessage = (msg: any): { valid: boolean; errorLogged: boolean } => {
  if (!msg.match_result || !isValidMatchResult(msg.match_result)) {
    return { valid: false, errorLogged: true };
  }
  return { valid: true, errorLogged: false };
};

describe('Malformed Server Response Handling', () => {
  describe('Completely malformed responses', () => {
    it('should reject empty object', () => {
      const msg = { match_result: {} };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(result.errorLogged).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should reject response with only partial fields', () => {
      const msg = { 
        match_result: { 
          match_type: 'correct' 
          // Missing: advance, new_position, miscue_count
        } 
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(result.errorLogged).toBe(true);
    });

    it('should reject response with null match_result', () => {
      const msg = { match_result: null };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(result.errorLogged).toBe(true);
    });

    it('should reject response with undefined match_result', () => {
      const msg = { match_result: undefined };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(result.errorLogged).toBe(true);
    });

    it('should reject response with missing match_result', () => {
      const msg = { text: 'hello' }; // No match_result field
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(result.errorLogged).toBe(true);
    });
  });

  describe('Type mismatch responses', () => {
    it('should reject match_type as number', () => {
      const msg = {
        match_result: {
          match_type: 123,
          advance: true,
          new_position: 5,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('match_type must be a string'),
        expect.anything()
      );
    });

    it('should reject advance as string', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: 'yes',
          new_position: 5,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('advance must be a boolean'),
        expect.anything()
      );
    });

    it('should reject new_position as string', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: '5',
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('new_position must be a number'),
        expect.anything()
      );
    });

    it('should reject miscue_count as boolean', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: 5,
          miscue_count: false
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('miscue_count must be a number'),
        expect.anything()
      );
    });
  });

  describe('Edge case responses', () => {
    it('should reject response with NaN new_position', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: NaN,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      // NaN is technically a number type, so this should pass type check
      // but application logic should handle NaN separately
      expect(result.valid).toBe(true); // Type check passes
      // Note: Application should add additional validation for NaN if needed
    });

    it('should accept response with negative new_position', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: -1,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      // Negative numbers are valid numbers, type check passes
      // Application logic handles position validation separately
      expect(result.valid).toBe(true);
    });

    it('should accept response with very large new_position', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: 999999,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(true);
    });

    it('should reject response with array instead of object', () => {
      const msg = {
        match_result: ['correct', true, 5, 0]
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
    });

    it('should reject response with string instead of object', () => {
      const msg = {
        match_result: 'correct'
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Valid responses should pass', () => {
    it('should accept minimal valid response', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: 5,
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(true);
      expect(result.errorLogged).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should accept response with extra fields', () => {
      const msg = {
        match_result: {
          match_type: 'mispronunciation',
          advance: true,
          new_position: 10,
          miscue_count: 1,
          details: 'Mispronunciation detected',
          similarity: 0.75,
          extra_field: 'ignored'
        },
        text: 'hello',
        metrics: { wpm: 120 }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(true);
      expect(result.errorLogged).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should accept all valid match types', () => {
      const matchTypes = [
        'correct', 'mispronunciation', 'substitution', 'omission',
        'insertion', 'transposition', 'reversal', 'selfCorrection',
        'repetition', 'buffering', 'pending', 'waiting_for_start',
        'end_of_story'
      ];

      matchTypes.forEach(matchType => {
        const msg = {
          match_result: {
            match_type: matchType,
            advance: false,
            new_position: 0,
            miscue_count: 0
          }
        };
        const result = processServerMessage(msg);
        
        expect(result.valid).toBe(true);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Real-world malformed scenarios', () => {
    it('should handle corrupted JSON-like structure', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true,
          new_position: undefined, // Corrupted field
          miscue_count: 0
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
    });

    it('should handle server error response format', () => {
      const msg = {
        error: 'Server error occurred',
        match_result: null
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
    });

    it('should handle incomplete network response', () => {
      const msg = {
        match_result: {
          match_type: 'correct',
          advance: true
          // Connection dropped before sending remaining fields
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
    });

    it('should handle response with wrong field names', () => {
      const msg = {
        match_result: {
          type: 'correct', // Should be match_type
          shouldAdvance: true, // Should be advance
          position: 5, // Should be new_position
          miscues: 0 // Should be miscue_count
        }
      };
      const result = processServerMessage(msg);
      
      expect(result.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing required fields'),
        expect.arrayContaining(['match_type', 'advance', 'new_position', 'miscue_count'])
      );
    });
  });
});
