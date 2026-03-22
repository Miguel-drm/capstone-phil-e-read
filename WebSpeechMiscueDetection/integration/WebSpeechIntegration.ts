/**
 * WebSpeech API Integration for Miscue Detection
 * Handles WebSpeech API integration with real-time miscue detection
 */

import { WebSpeechMiscueDetector } from '../core/MiscueDetector';
import { 
  MiscueDetectionConfig, 
  WebSpeechConfig, 
  DetectionCallbacks,
  MiscueEvent,
  DetectionResult
} from '../types/MiscueTypes';

export class WebSpeechMiscueIntegration {
  private detector: WebSpeechMiscueDetector;
  private recognition: SpeechRecognition | null = null;
  private isActive: boolean = false;
  private config: WebSpeechConfig;
  private callbacks: Partial<DetectionCallbacks>;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 5;
  private restartDelay: number = 1000;

  constructor(
    detectionConfig: MiscueDetectionConfig,
    webSpeechConfig: WebSpeechConfig,
    callbacks?: Partial<DetectionCallbacks>
  ) {
    this.detector = new WebSpeechMiscueDetector(detectionConfig, callbacks);
    this.config = webSpeechConfig;
    this.callbacks = callbacks || {};

    // Check WebSpeech support
    if (!this.isWebSpeechSupported()) {
      throw new Error('WebSpeech API is not supported in this browser');
    }

    console.log('🌐 WebSpeech Miscue Integration initialized');
  }

  /**
   * Check if WebSpeech API is supported
   */
  private isWebSpeechSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Start speech recognition with miscue detection
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      console.warn('⚠️ WebSpeech recognition is already active');
      return;
    }

    try {
      await this.initializeRecognition();
      this.recognition!.start();
      this.isActive = true;
      this.restartAttempts = 0;
      
      console.log('🎤 WebSpeech recognition started with miscue detection');
    } catch (error) {
      console.error('❌ Failed to start WebSpeech recognition:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * Stop speech recognition
   */
  public stop(): void {
    if (!this.isActive || !this.recognition) {
      return;
    }

    this.recognition.stop();
    this.isActive = false;
    this.restartAttempts = 0;
    
    console.log('🛑 WebSpeech recognition stopped');
  }

  /**
   * Initialize speech recognition
   */
  private async initializeRecognition(): Promise<void> {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
    this.recognition.lang = this.config.lang;

    if (this.config.grammars) {
      this.recognition.grammars = this.config.grammars;
    }

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up WebSpeech event handlers
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('🎙️ WebSpeech recognition started');
      this.restartAttempts = 0;
    };

    this.recognition.onresult = async (event: SpeechRecognitionEvent) => {
      await this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onend = () => {
      this.handleRecognitionEnd();
    };
  }

  /**
   * Handle recognition results
   */
  private async handleRecognitionResult(event: SpeechRecognitionEvent): Promise<void> {
    try {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 1.0;
        const isFinal = result.isFinal;

        if (transcript.length === 0) continue;

        console.log(`🎙️ WebSpeech ${isFinal ? 'final' : 'interim'}: "${transcript}" (confidence: ${confidence.toFixed(2)})`);

        // Process only final results for miscue detection
        if (isFinal) {
          await this.processTranscript(transcript, confidence);
        }
      }
    } catch (error) {
      console.error('❌ Error processing recognition result:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }

  /**
   * Process transcript for miscue detection
   */
  private async processTranscript(transcript: string, confidence: number): Promise<void> {
    // Split transcript into words
    const words = transcript.toLowerCase().split(/\s+/).filter(word => word.length > 0);

    // Process each word through miscue detector
    for (const word of words) {
      try {
        const result: DetectionResult = await this.detector.processSpokenWord(
          word,
          confidence,
          Date.now()
        );

        // Handle detection result
        if (result.miscue) {
          await this.handleMiscueDetected(result.miscue, result);
        }

        // Add small delay between words to prevent overwhelming
        await this.delay(10);
        
      } catch (error) {
        console.error(`❌ Error processing word "${word}":`, error);
      }
    }
  }

  /**
   * Handle detected miscue
   */
  private async handleMiscueDetected(miscue: MiscueEvent, result: DetectionResult): Promise<void> {
    console.log(`🎯 Miscue detected: ${miscue.type} - "${miscue.spokenWord}" vs "${miscue.expectedWord}"`);

    // Trigger callback
    if (this.callbacks.onMiscueDetected) {
      this.callbacks.onMiscueDetected(miscue);
    }

    // Handle position advancement
    if (result.shouldAdvance && this.callbacks.onPositionAdvanced) {
      this.callbacks.onPositionAdvanced(result.newPosition);
    }

    // Handle correct words
    if (miscue.type === 'correct' && this.callbacks.onWordCorrect) {
      this.callbacks.onWordCorrect(miscue.expectedWord, miscue.position);
    }

    // Update performance metrics
    if (this.callbacks.onPerformanceUpdate) {
      const metrics = this.detector.getPerformanceMetrics();
      this.callbacks.onPerformanceUpdate(metrics);
    }
  }

  /**
   * Handle recognition errors
   */
  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
    console.error(`❌ WebSpeech recognition error: ${event.error}`, event.message);

    const error = new Error(`WebSpeech recognition error: ${event.error} - ${event.message}`);

    // Handle specific error types
    switch (event.error) {
      case 'not-allowed':
        console.error('🚫 Microphone access denied');
        this.isActive = false;
        break;
      
      case 'no-speech':
        console.warn('🔇 No speech detected - this is normal');
        // Don't treat as fatal error
        return;
      
      case 'network':
        console.warn('🌐 Network error - will attempt restart');
        this.attemptRestart();
        return;
      
      case 'aborted':
        console.log('⏹️ Recognition aborted');
        this.isActive = false;
        return;
      
      default:
        console.error(`❌ Unknown error: ${event.error}`);
        break;
    }

    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Handle recognition end
   */
  private handleRecognitionEnd(): void {
    console.log('🔌 WebSpeech recognition ended');

    // Attempt restart if still active and not too many attempts
    if (this.isActive && this.restartAttempts < this.maxRestartAttempts) {
      this.attemptRestart();
    } else {
      this.isActive = false;
    }
  }

  /**
   * Attempt to restart recognition
   */
  private attemptRestart(): void {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error(`❌ Max restart attempts (${this.maxRestartAttempts}) reached`);
      this.isActive = false;
      return;
    }

    this.restartAttempts++;
    const delay = this.restartDelay * this.restartAttempts;

    console.log(`🔄 Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts} in ${delay}ms...`);

    setTimeout(() => {
      if (this.isActive) {
        try {
          this.recognition?.start();
        } catch (error) {
          console.error('❌ Failed to restart recognition:', error);
          this.isActive = false;
        }
      }
    }, delay);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current detector state
   */
  public getDetectorState(): {
    isActive: boolean;
    currentPosition: number;
    metrics: any;
  } {
    return {
      isActive: this.isActive,
      currentPosition: this.detector.getCurrentPosition(),
      metrics: this.detector.getPerformanceMetrics()
    };
  }

  /**
   * Reset detector
   */
  public reset(): void {
    this.detector.reset();
    this.restartAttempts = 0;
    console.log('🔄 WebSpeech Miscue Integration reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(webSpeechConfig: Partial<WebSpeechConfig>): void {
    this.config = { ...this.config, ...webSpeechConfig };
    
    // If recognition is active, restart with new config
    if (this.isActive) {
      this.stop();
      setTimeout(() => {
        this.start();
      }, 100);
    }
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): string {
    return this.detector.getPerformanceMetrics().toString();
  }
}