import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for match result validation
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

describe('isValidMatchResult', () => {
  it('should return true for valid match result with all required fields', () => {
    const validResult = {
      match_type: 'correct',
      advance: true,
      new_position: 5,
      miscue_count: 0,
      details: 'Word matched correctly'
    };

    expect(isValidMatchResult(validResult)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should return false for null result', () => {
    expect(isValidMatchResult(null)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: result is null or undefined'
    );
  });

  it('should return false for undefined result', () => {
    expect(isValidMatchResult(undefined)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: result is null or undefined'
    );
  });

  it('should return false when match_type is missing', () => {
    const invalidResult = {
      advance: true,
      new_position: 5,
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: missing required fields:',
      ['match_type']
    );
  });

  it('should return false when advance is missing', () => {
    const invalidResult = {
      match_type: 'correct',
      new_position: 5,
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: missing required fields:',
      ['advance']
    );
  });

  it('should return false when new_position is missing', () => {
    const invalidResult = {
      match_type: 'correct',
      advance: true,
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: missing required fields:',
      ['new_position']
    );
  });

  it('should return false when miscue_count is missing', () => {
    const invalidResult = {
      match_type: 'correct',
      advance: true,
      new_position: 5
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: missing required fields:',
      ['miscue_count']
    );
  });

  it('should return false when multiple fields are missing', () => {
    const invalidResult = {
      match_type: 'correct'
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: missing required fields:',
      ['advance', 'new_position', 'miscue_count']
    );
  });

  it('should return false when match_type is not a string', () => {
    const invalidResult = {
      match_type: 123,
      advance: true,
      new_position: 5,
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: match_type must be a string, got:',
      'number'
    );
  });

  it('should return false when advance is not a boolean', () => {
    const invalidResult = {
      match_type: 'correct',
      advance: 'true',
      new_position: 5,
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: advance must be a boolean, got:',
      'string'
    );
  });

  it('should return false when new_position is not a number', () => {
    const invalidResult = {
      match_type: 'correct',
      advance: true,
      new_position: '5',
      miscue_count: 0
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: new_position must be a number, got:',
      'string'
    );
  });

  it('should return false when miscue_count is not a number', () => {
    const invalidResult = {
      match_type: 'correct',
      advance: true,
      new_position: 5,
      miscue_count: '0'
    };

    expect(isValidMatchResult(invalidResult)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: miscue_count must be a number, got:',
      'string'
    );
  });

  it('should accept valid match result with additional optional fields', () => {
    const validResult = {
      match_type: 'mispronunciation',
      advance: true,
      new_position: 10,
      miscue_count: 1,
      details: 'Mispronunciation detected',
      similarity: 0.75,
      session_state: {
        current_position: 10,
        words_read: 10,
        total_miscues: 1
      }
    };

    expect(isValidMatchResult(validResult)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should accept match result with advance=false', () => {
    const validResult = {
      match_type: 'buffering',
      advance: false,
      new_position: 5,
      miscue_count: 0
    };

    expect(isValidMatchResult(validResult)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should accept match result with miscue_count > 0', () => {
    const validResult = {
      match_type: 'substitution',
      advance: true,
      new_position: 8,
      miscue_count: 1
    };

    expect(isValidMatchResult(validResult)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should reject result that is a string primitive', () => {
    expect(isValidMatchResult('correct')).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: result must be an object, got:',
      'string'
    );
  });

  it('should reject result that is an array', () => {
    expect(isValidMatchResult(['correct', true, 5, 0])).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: result must be an object, got:',
      'object'
    );
  });

  it('should reject result that is a number', () => {
    expect(isValidMatchResult(123)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Invalid match result: result must be an object, got:',
      'number'
    );
  });
});
