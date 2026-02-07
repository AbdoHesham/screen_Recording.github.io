import { useState, useRef, useCallback } from 'react';

export type RecordingMode = 'screen' | 'voice';
export type AudioSource = 'system' | 'microphone' | 'both' | 'none';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  blob: Blob | null;
  previewUrl: string | null;
  transcription: string;
  isTranscribing: boolean;
}

export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    blob: null,
    previewUrl: null,
    transcription: '',
    isTranscribing: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Start recording timer
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  // Stop recording timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start speech recognition for transcription
  const startTranscription = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('Speech recognition not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setState((prev) => ({ ...prev, isTranscribing: true }));
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setState((prev) => ({
          ...prev,
          transcription: prev.transcription + finalTranscript,
        }));
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        setState((prev) => ({ ...prev, isTranscribing: false }));
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  }, []);

  // Stop speech recognition
  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (error) {
        console.error('Failed to stop transcription:', error);
      }
    }
  }, []);

  // Setup MediaRecorder
  const setupMediaRecorder = useCallback((stream: MediaStream, mode: RecordingMode) => {
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000,
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.log('MediaRecorder not supported, trying default options');
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mode === 'screen' ? 'video/webm' : 'audio/webm',
      });

      const url = URL.createObjectURL(blob);

      setState((prev) => ({
        ...prev,
        blob,
        previewUrl: url,
        isRecording: false,
        isPaused: false,
      }));

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      stopTimer();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    streamRef.current = stream;
    startTimer();
    startTranscription();
  }, [startTimer, stopTimer, startTranscription]);

  // Start screen recording
  const startScreenRecording = useCallback(async (audioSource: AudioSource) => {
    try {
      const displayOptions: DisplayMediaStreamOptions = {
        video: {
          // @ts-ignore - TypeScript doesn't have full DisplayMediaStreamOptions types
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: audioSource === 'system' || audioSource === 'both',
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
      let combinedStream = screenStream;

      if (audioSource === 'microphone' || audioSource === 'both') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          if (audioSource === 'both') {
            // Mix both audio sources
            const audioContext = new AudioContext();
            const screenSource = audioContext.createMediaStreamSource(screenStream);
            const micSource = audioContext.createMediaStreamSource(micStream);
            const destination = audioContext.createMediaStreamDestination();

            screenSource.connect(destination);
            micSource.connect(destination);

            const videoTracks = screenStream.getVideoTracks();
            const audioTracks = destination.stream.getAudioTracks();
            combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
          } else {
            // Use only microphone audio
            const videoTracks = screenStream.getVideoTracks();
            const audioTracks = micStream.getAudioTracks();
            combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
          }
        } catch (error) {
          console.log('Microphone not available, using screen audio only:', error);
        }
      }

      setupMediaRecorder(combinedStream, 'screen');
      setState((prev) => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));

      return true;
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      throw new Error('Failed to start screen recording. Please check permissions.');
    }
  }, [setupMediaRecorder]);

  // Start voice recording
  const startVoiceRecording = useCallback(async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!audioStream || audioStream.getTracks().length === 0) {
        throw new Error('No audio stream available');
      }

      setupMediaRecorder(audioStream, 'voice');
      setState((prev) => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));

      return true;
    } catch (error) {
      console.error('Voice recording failed:', error);
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }, [setupMediaRecorder]);

  // Start recording
  const startRecording = useCallback(async (mode: RecordingMode, audioSource: AudioSource = 'system') => {
    chunksRef.current = [];

    if (mode === 'screen') {
      return await startScreenRecording(audioSource);
    } else {
      return await startVoiceRecording();
    }
  }, [startScreenRecording, startVoiceRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopTranscription();
  }, [stopTranscription]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState((prev) => ({ ...prev, isPaused: true }));
      stopTimer();
      stopTranscription();
    }
  }, [stopTimer, stopTranscription]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, isPaused: false }));
      startTimer();
      startTranscription();
    }
  }, [startTimer, startTranscription]);

  // Reset recording state
  const resetRecording = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    chunksRef.current = [];
    stopTranscription();
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      blob: null,
      previewUrl: null,
      transcription: '',
      isTranscribing: false,
    });
  }, [state.previewUrl, stopTranscription]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
