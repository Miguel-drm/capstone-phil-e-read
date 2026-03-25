/**
 * WebSpeech Diagnostics and Troubleshooting Utility
 * Comprehensive diagnostic tool for WebSpeech API issues
 */

export interface DiagnosticResult {
  test: string;
  passed: boolean;
  message: string;
  details?: string;
  solution?: string;
}

export interface ComprehensiveDiagnostic {
  overallStatus: 'pass' | 'fail' | 'warning';
  results: DiagnosticResult[];
  recommendations: string[];
  canProceed: boolean;
}

/**
 * Run comprehensive WebSpeech diagnostics
 */
export async function runWebSpeechDiagnostics(): Promise<ComprehensiveDiagnostic> {
  const results: DiagnosticResult[] = [];
  let canProceed = true;

  // Test 1: Browser Support
  console.log('🔍 Test 1: Browser Support');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    results.push({
      test: 'Browser Support',
      passed: false,
      message: 'WebSpeech API not supported',
      details: `Browser: ${navigator.userAgent}`,
      solution: 'Use Chrome, Edge, or Safari. Firefox has limited support.'
    });
    canProceed = false;
  } else {
    results.push({
      test: 'Browser Support',
      passed: true,
      message: 'WebSpeech API is available',
      details: `Browser supports SpeechRecognition API`
    });
  }

  // Test 2: HTTPS/Secure Context
  console.log('🔍 Test 2: Secure Context');
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
  
  results.push({
    test: 'Secure Context',
    passed: isSecure,
    message: isSecure ? 'Running in secure context' : 'May require HTTPS',
    details: `Protocol: ${location.protocol}, Host: ${location.hostname}`,
    solution: isSecure ? undefined : 'Use HTTPS in production environments'
  });

  // Test 3: Internet Connection
  console.log('🔍 Test 3: Internet Connection');
  const isOnline = navigator.onLine;
  
  if (!isOnline) {
    results.push({
      test: 'Internet Connection',
      passed: false,
      message: 'No internet connection detected',
      details: 'WebSpeech API requires internet connectivity',
      solution: 'Check your internet connection and try again'
    });
    canProceed = false;
  } else {
    results.push({
      test: 'Internet Connection',
      passed: true,
      message: 'Internet connection available',
      details: 'Online status: connected'
    });
  }

  // Test 4: MediaDevices API
  console.log('🔍 Test 4: MediaDevices API');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    results.push({
      test: 'MediaDevices API',
      passed: false,
      message: 'MediaDevices API not available',
      details: 'Required for microphone access',
      solution: 'Update your browser to a newer version'
    });
    canProceed = false;
  } else {
    results.push({
      test: 'MediaDevices API',
      passed: true,
      message: 'MediaDevices API available',
      details: 'Can request microphone access'
    });
  }

  // Test 5: Microphone Permission
  console.log('🔍 Test 5: Microphone Permission');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Test microphone for 2 seconds
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let hasAudio = false;
    
    // Check for audio input
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      if (average > 5) {
        hasAudio = true;
        break;
      }
    }
    
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();
    
    results.push({
      test: 'Microphone Permission',
      passed: true,
      message: hasAudio ? 'Microphone working with audio input' : 'Microphone connected but no audio detected',
      details: hasAudio ? 'Audio input detected' : 'No audio input - speak into microphone',
      solution: hasAudio ? undefined : 'Speak into your microphone or check microphone settings'
    });
    
  } catch (micError: any) {
    let message = 'Microphone access failed';
    let solution = 'Check microphone and permissions';
    
    if (micError.name === 'NotAllowedError') {
      message = 'Microphone permission denied';
      solution = 'Click "Allow" when browser asks for microphone access, or check browser settings';
    } else if (micError.name === 'NotFoundError') {
      message = 'No microphone found';
      solution = 'Connect a microphone and ensure it\'s set as default device';
    } else if (micError.name === 'NotReadableError') {
      message = 'Microphone in use by another application';
      solution = 'Close other apps using microphone (Zoom, Teams, etc.)';
    }
    
    results.push({
      test: 'Microphone Permission',
      passed: false,
      message,
      details: `Error: ${micError.name} - ${micError.message}`,
      solution
    });
    canProceed = false;
  }

  // Test 6: WebSpeech Recognition Creation
  console.log('🔍 Test 6: WebSpeech Recognition Creation');
  if (SpeechRecognition) {
    try {
      const testRecognition = new SpeechRecognition();
      testRecognition.continuous = true;
      testRecognition.interimResults = true;
      testRecognition.lang = 'en-US';
      
      results.push({
        test: 'WebSpeech Creation',
        passed: true,
        message: 'WebSpeech recognition object created successfully',
        details: 'All required properties are available'
      });
      
    } catch (createError: any) {
      results.push({
        test: 'WebSpeech Creation',
        passed: false,
        message: 'Failed to create WebSpeech recognition',
        details: `Error: ${createError.message}`,
        solution: 'Try refreshing the page or using a different browser'
      });
      canProceed = false;
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  const failedTests = results.filter(r => !r.passed);
  
  if (failedTests.length === 0) {
    recommendations.push('✅ All tests passed! WebSpeech should work correctly.');
    recommendations.push('If you still experience issues, try refreshing the page.');
  } else {
    recommendations.push('❌ Some tests failed. Follow these steps:');
    failedTests.forEach((test, index) => {
      if (test.solution) {
        recommendations.push(`${index + 1}. ${test.test}: ${test.solution}`);
      }
    });
  }

  // Determine overall status
  let overallStatus: 'pass' | 'fail' | 'warning' = 'pass';
  if (failedTests.length > 0) {
    overallStatus = canProceed ? 'warning' : 'fail';
  }

  return {
    overallStatus,
    results,
    recommendations,
    canProceed
  };
}

/**
 * Quick microphone test
 */
export async function quickMicrophoneTest(): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  try {
    console.log('🎤 Quick microphone test...');
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Test for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    stream.getTracks().forEach(track => track.stop());
    
    return {
      success: true,
      message: 'Microphone test passed',
      details: 'Microphone is accessible and working'
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: 'Microphone test failed',
      details: `${error.name}: ${error.message}`
    };
  }
}

/**
 * Get browser compatibility info
 */
export function getBrowserCompatibility(): {
  browser: string;
  compatible: boolean;
  recommendation: string;
} {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Chrome')) {
    return {
      browser: 'Chrome',
      compatible: true,
      recommendation: 'Excellent WebSpeech support'
    };
  } else if (userAgent.includes('Edge')) {
    return {
      browser: 'Edge',
      compatible: true,
      recommendation: 'Good WebSpeech support'
    };
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return {
      browser: 'Safari',
      compatible: true,
      recommendation: 'Good WebSpeech support'
    };
  } else if (userAgent.includes('Firefox')) {
    return {
      browser: 'Firefox',
      compatible: false,
      recommendation: 'Limited WebSpeech support - use Chrome or Edge instead'
    };
  } else {
    return {
      browser: 'Unknown',
      compatible: false,
      recommendation: 'Unknown browser - use Chrome, Edge, or Safari for best results'
    };
  }
}

export default {
  runWebSpeechDiagnostics,
  quickMicrophoneTest,
  getBrowserCompatibility
};