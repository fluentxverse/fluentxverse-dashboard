import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { apiClient as api } from '../api/apiClient';
import { API_BASE_URL } from '../config/api';
import { interviewApi } from '../api/interview.api';
import { InterviewCall } from '../../../shared/interviewCall';
import { InterviewRecording } from '../client/interviewRecording';
import { createRealtimeSocket, type RealtimeSocket } from '../client/realtimeSocket';
import './InterviewRoomPage.css';

interface InterviewRoomPageProps {
  interviewId?: string;
  tutorId?: string;
  tutorName?: string;
}

interface RubricScores {
  grammar: number;
  fluency: number;
  pronunciation: number;
  vocabulary: number;
  professionalism: number;
}

interface TimestampNote {
  time: string;
  note: string;
}

const InterviewRoomPage = (props: InterviewRoomPageProps) => {
  const route = useRoute();
  const interviewId = props.interviewId || route.params.interviewId;
  const [room, setRoom] = useState<Awaited<ReturnType<typeof interviewApi.getRoom>> | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const tutorId = room?.tutorId;
  const tutorName = room?.tutorName;
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const mounted = useRef(true);
  const callRef = useRef<InterviewCall | null>(null);
  const recordingRef = useRef<InterviewRecording | null>(null);
  const pendingRecording = useRef<{ blob: Blob; id: string } | null>(null);
  const [hasPendingRecording, setHasPendingRecording] = useState(false);
  const uploadRef = useRef<Promise<boolean> | null>(null);
  const stoppingRecording = useRef<Promise<void> | null>(null);
  const previewVersion = useRef(0);
  useEffect(() => {
    let active = true;
    if (!interviewId) { setError('Select a booked interview from the schedule.'); setRoomLoading(false); return; }
    interviewApi.getRoom(interviewId).then(data => {
      if (active) {
        setRoom(data);
        if (data.hasRecording) setRecordingUrl(`/interview/recording/${encodeURIComponent(data.id)}`);
        if (data.status !== 'booked' || data.mediaClosed) { setEnded(true); endedRef.current = true; setSetupComplete(true); }
      }
    }).catch(failure => { if (active) setError(failure.response?.data?.error || failure.message); })
      .finally(() => { if (active) setRoomLoading(false); });
    return () => { active = false; };
  }, [interviewId]);
  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pre-call setup states
  const [setupComplete, setSetupComplete] = useState(false);
  const [deviceTestPassed, setDeviceTestPassed] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  
  // Call states
  const [callDuration, setCallDuration] = useState(0);
  const [tutorConnected, setTutorConnected] = useState(false);
  
  // Notes & Rubric state
  const [notes, setNotes] = useState<string>('');
  const [timestampNotes, setTimestampNotes] = useState<TimestampNote[]>([]);
  const [rubricScores, setRubricScores] = useState<RubricScores>({
    grammar: 3,
    fluency: 3,
    pronunciation: 3,
    vocabulary: 3,
    professionalism: 3
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  
  // Confirmation dialog states
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [showFailConfirm, setShowFailConfirm] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const roomIdRef = useRef<string>(`interview-${interviewId || 'default'}`);

  // Format current time for timestamps
  const formatCurrentTime = () => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add timestamp note
  const addTimestampNote = () => {
    if (notes.trim()) {
      const newNote: TimestampNote = {
        time: formatCurrentTime(),
        note: notes.trim()
      };
      setTimestampNotes(prev => [...prev, newNote]);
      setNotes('');
    }
  };

  // Update rubric score
  const updateRubricScore = (category: keyof RubricScores, score: number) => {
    setRubricScores(prev => ({ ...prev, [category]: score }));
  };

  // Calculate average score
  const calculateAverageScore = () => {
    const scores = Object.values(rubricScores);
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  // Auto-save to localStorage
  useEffect(() => {
    if (setupComplete && interviewId) {
      const saveData = {
        notes,
        timestampNotes,
        rubricScores,
        callDuration
      };
      try {
        localStorage.setItem(`interview-${interviewId}`, JSON.stringify(saveData));
        setLastSaved(new Date().toLocaleTimeString());
      } catch { setError('Notes could not be saved locally. Keep this tab open until the result is submitted.'); }
    }
  }, [notes, timestampNotes, rubricScores, setupComplete, interviewId]);

  // Load saved data on mount
  useEffect(() => {
    if (interviewId) {
      const saved = localStorage.getItem(`interview-${interviewId}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.notes) setNotes(data.notes);
          if (data.timestampNotes) setTimestampNotes(data.timestampNotes);
          if (data.rubricScores) setRubricScores(data.rubricScores);
        } catch (e) {
          console.error('Failed to load saved data:', e);
        }
      }
    }
  }, [interviewId]);

  // Submit interview result (pass/fail)
  const submitResult = async (result: 'pass' | 'fail') => {
    if (!interviewId || !tutorId) {
      setError('Missing interview or tutor information');
      return;
    }

    if (isSaving || recordingUploading || room?.result) return;
    setIsSaving(true);
    try {
      await handleEndCall();
      if (pendingRecording.current && !await uploadRecording()) throw Error('Upload the recording before submitting the result.');
      const response = await api.post('/interview/result', {
        slotId: interviewId,
        tutorId: tutorId,
        result,
        rubricScores,
        notes: timestampNotes.map(t => `[${t.time}] ${t.note}`).join('\n') + (notes ? `\n[Final] ${notes}` : ''),
        timestamps: timestampNotes
      });
      if (!response.data.success) throw Error(response.data.error || 'Failed to submit result');

      setResultSubmitted(true);
      localStorage.removeItem(`interview-${interviewId}`);
      
      // Show success and redirect
      setTimeout(() => {
        window.location.href = '/applications';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit result');
    } finally {
      setIsSaving(false);
    }
  };

  // Get available devices and auto-start preview
  useEffect(() => {
    const getDevices = async () => {
      const version = ++previewVersion.current;
      try {
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted.current || endedRef.current || version !== previewVersion.current) { initialStream.getTracks().forEach(track => track.stop()); return; }
        localStreamRef.current = initialStream;
        setLocalStream(initialStream);
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        setCameras(videoDevices);
        setMics(audioDevices);
        
        if (videoDevices.length > 0) setSelectedCamera(videoDevices[0].deviceId);
        if (audioDevices.length > 0) setSelectedMic(audioDevices[0].deviceId);
        setDeviceTestPassed(true);
      } catch (err) {
        console.error('Error getting devices:', err);
        setError('Could not access camera or microphone. Please check permissions.');
      }
    };
    
    if (room?.status === 'booked' && !ended) void getDevices();
    return () => { previewVersion.current++; };
  }, [room?.id, ended]);

  // Sync video element with stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Re-attach stream when transitioning to call view (DOM element changes)
  useEffect(() => {
    if (setupComplete && localStream && localVideoRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
        }
      }, 100);
    }
  }, [setupComplete, localStream]);

  // Sync remote video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const startPreview = async () => {
    const version = ++previewVersion.current;
    if (endedRef.current) return;
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mounted.current || endedRef.current || version !== previewVersion.current) { stream.getTracks().forEach(track => track.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      setTimeout(() => {
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      }, 100);
      
      setDeviceTestPassed(true);
      setError(null);
    } catch (err) {
      console.error('Error starting preview:', err);
      setError('Failed to start camera preview. Please check your device permissions.');
      setDeviceTestPassed(false);
    }
  };

  const stopPreview = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const joinRoom = async () => {
    if (!localStreamRef.current || room?.status !== 'booked' || endedRef.current || isConnecting) {
      setError('Please test your devices first');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      callRef.current?.close(); socketRef.current?.disconnect();
      const socket = createRealtimeSocket();
      socketRef.current = socket;
      const call = new InterviewCall({ socket, roomId: roomIdRef.current, role: 'admin', stream: localStreamRef.current,
        onStream: stream => { if (mounted.current) { setRemoteStream(stream); if (!stream && recordingRef.current) void stopRecording(); } },
        onState: state => {
          if (!mounted.current) return;
          setIsConnected(state === 'connected'); setIsConnecting(['connecting', 'reconnecting'].includes(state));
          setTutorConnected(['connected', 'connecting', 'reconnecting'].includes(state));
          if (state === 'connected') { setError(null); startCallTimer(); } else stopCallTimer();
        },
        onError: message => { if (mounted.current) { setError(message); setIsConnecting(false); } },
        onEnded: () => { void handleEndCall(false); },
      });
      callRef.current = call;
      const ready = call.start();
      void socket.connect();
      await ready;
      if (mounted.current && !endedRef.current) setSetupComplete(true);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join interview room');
      setIsConnecting(false);
      callRef.current?.close(); socketRef.current?.disconnect();
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Recording functions
  const startRecording = () => {
    if (!localStream || !remoteStream || !isConnected || recordingRef.current || pendingRecording.current) {
      setError('Both participants must be connected before recording. Upload any pending recording first.');
      return;
    }

    try {
      recordingRef.current = new InterviewRecording(localStream, remoteStream, () => { void stopRecording(); });
      setIsRecording(true);
      socketRef.current?.emit('interview:recording-status', { roomId: roomIdRef.current, recording: true });
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Your browser may not support this feature.');
    }
  };

  const stopRecording = (): Promise<void> => {
    const recorder = recordingRef.current;
    if (!recorder) return stoppingRecording.current || Promise.resolve();
    recordingRef.current = null;
    setIsRecording(false); setRecordingUploading(true);
    socketRef.current?.emit('interview:recording-status', { roomId: roomIdRef.current, recording: false });
    const stop = (async () => { const blob = await recorder.stop();
    if (!blob.size) { setRecordingUploading(false); setError('Recording was empty.'); return; }
    pendingRecording.current = { blob, id: crypto.randomUUID() };
    setHasPendingRecording(true);
    await uploadRecording();
    })().finally(() => { stoppingRecording.current = null; });
    stoppingRecording.current = stop;
    return stop;
  };

  const uploadRecording = async (): Promise<boolean> => {
    if (uploadRef.current) return uploadRef.current;
    const pending = pendingRecording.current;
    if (!pending) return true;
    setRecordingUploading(true);
    const upload = (async () => { try {
      const { blob, id } = pending;
      const formData = new FormData();
      formData.append('recording', blob, `interview-${interviewId}.${blob.type === 'video/mp4' ? 'mp4' : 'webm'}`);
      formData.append('slotId', interviewId!);
      formData.append('tutorId', tutorId!);
      formData.append('recordingId', id);

      const response = await api.post('/interview/recording', formData, {
        timeout: 90000
      });

      if (response.data.success) {
        setRecordingUrl(response.data.url);
        setError(null);
        pendingRecording.current = null; setHasPendingRecording(false); return true;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err: any) {
      console.error('Failed to upload recording:', err);
      setError('Failed to upload recording: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setRecordingUploading(false);
      uploadRef.current = null;
    }
    })();
    uploadRef.current = upload;
    return upload;
  };

  const startCallTimer = () => {
    if (callTimerRef.current !== null) return;
    callTimerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async (notify = true) => {
    if (endedRef.current) { if (stoppingRecording.current) await stoppingRecording.current; if (uploadRef.current) await uploadRef.current; return; }
    endedRef.current = true; previewVersion.current++;
    stopCallTimer();
    const recordingDone = stopRecording();
    if (notify) callRef.current?.end(); else callRef.current?.close();
    socketRef.current?.disconnect(); socketRef.current = null;
    stopPreview(); setEnded(true); setIsConnecting(false);
    setIsConnected(false);
    setRemoteStream(null);
    setTutorConnected(false);
    await recordingDone;
  };

  useEffect(() => {
    return () => {
      mounted.current = false; previewVersion.current++;
      stopCallTimer();
      stopPreview();
      callRef.current?.close();
      if (recordingRef.current) void recordingRef.current.stop();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!setupComplete || ended) return;
    const renew = () => { void api.get('/admin/me').catch(() => {}); };
    const timer = setInterval(renew, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [setupComplete, ended]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (recordingRef.current || pendingRecording.current || uploadRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Rubric category labels
  const rubricCategories = [
    { key: 'grammar', label: 'Grammar & Accuracy', icon: 'ri-text' },
    { key: 'fluency', label: 'Fluency & Flow', icon: 'ri-speed-line' },
    { key: 'pronunciation', label: 'Pronunciation', icon: 'ri-volume-up-line' },
    { key: 'vocabulary', label: 'Vocabulary Range', icon: 'ri-book-open-line' },
    { key: 'professionalism', label: 'Professionalism', icon: 'ri-user-star-line' }
  ];

  return (
    <div className="interview-room">
      {resultSubmitted ? (
        <div className="result-submitted">
          <div className="result-card">
            <div className="result-icon success">
              <i className="ri-checkbox-circle-fill"></i>
            </div>
            <h2>Interview Result Submitted!</h2>
            <p>Redirecting to applications...</p>
          </div>
        </div>
      ) : !setupComplete ? (
        <div className="interview-setup">
          <div className="setup-container">
            <div className="setup-header">
              <div className="setup-icon">
                <i className="ri-video-chat-line"></i>
              </div>
              <h1>Interview Room</h1>
              <p>{roomLoading ? 'Loading booked interview...' : tutorName || 'Interview unavailable'}</p>
            </div>

            {error && (
              <div className="setup-error">
                <i className="ri-error-warning-line"></i>
                {error}
              </div>
            )}

            <div className="setup-content">
              <div className="video-preview-container">
                <div className="video-preview">
                  {localStream ? (
                    <video ref={localVideoRef} autoPlay muted playsInline />
                  ) : (
                    <div className="video-placeholder">
                      <i className="ri-camera-line"></i>
                      <p>Camera preview will appear here</p>
                    </div>
                  )}
                </div>
                
                {deviceTestPassed && (
                  <div className="device-status success">
                    <i className="ri-check-line"></i>
                    Devices working correctly
                  </div>
                )}
              </div>

              <div className="device-selection">
                <div className="device-group">
                  <label><i className="ri-camera-line"></i> Camera</label>
                  <select disabled={ended || isConnecting} value={selectedCamera} onChange={(e) => { setSelectedCamera((e.target as HTMLSelectElement).value); setDeviceTestPassed(false); }}>
                    {cameras.map(camera => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="device-group">
                  <label><i className="ri-mic-line"></i> Microphone</label>
                  <select disabled={ended || isConnecting} value={selectedMic} onChange={(e) => { setSelectedMic((e.target as HTMLSelectElement).value); setDeviceTestPassed(false); }}>
                    {mics.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mics.indexOf(mic) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <button disabled={ended || !room || isConnecting} className="btn-test-devices" onClick={startPreview}>
                  <i className="ri-refresh-line"></i> Test Devices
                </button>
              </div>
            </div>

            <div className="setup-actions">
              <button className="btn-back" onClick={() => window.location.href = '/interviews'}>
                <i className="ri-arrow-left-line"></i> Back
              </button>
              <button className="btn-join" onClick={joinRoom} disabled={!deviceTestPassed || isConnecting || roomLoading || !room || ended}>
                {isConnecting ? (
                  <><i className="ri-loader-4-line ri-spin"></i> Connecting...</>
                ) : (
                  <><i className="ri-video-chat-line"></i> Start Interview</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="interview-call">
          <div className="call-header">
            <div className="call-info">
              <button 
                className="btn-back-header" 
                title="Back to Interviews"
                onClick={() => window.location.href = '/interviews'}
              >
                <i className="ri-arrow-left-line"></i>
              </button>
              <span className="call-status">
                {ended ? <><i className="ri-checkbox-circle-line"></i> Interview ended</> : isConnected ? (
                  <><i className="ri-record-circle-fill live"></i> Live</>
                ) : tutorConnected ? (
                  <><i className="ri-loader-4-line ri-spin"></i> Connecting...</>
                ) : (
                  <><i className="ri-time-line"></i> Waiting for candidate...</>
                )}
              </span>
              {(isConnected || callDuration > 0) && (
                <span className="call-duration">{formatDuration(callDuration)}</span>
              )}
            </div>
            <div className="call-title">
              <i className="ri-video-chat-line"></i>
              Speaking Interview {tutorName && <span className="candidate-name">- {tutorName}</span>}
            </div>
            {lastSaved && (
              <div className="auto-save-indicator">
                <i className="ri-save-line"></i> Auto-saved {lastSaved}
              </div>
            )}
          </div>

          <div className="call-body">
            <div className="video-section">
              <div className="video-grid">
                <div className="video-container remote">
                  {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline />
                  ) : (
                    <div className="video-placeholder">
                      <div className="avatar-placeholder">
                        <i className="ri-user-line"></i>
                      </div>
                      <p>{tutorConnected ? 'Connecting video...' : 'Waiting for candidate to join...'}</p>
                    </div>
                  )}
                  <div className="video-label">Candidate</div>
                </div>

                <div className="video-container local">
                  <video ref={localVideoRef} autoPlay muted playsInline />
                  {!isVideoEnabled && (
                    <div className="video-off-overlay">
                      <i className="ri-camera-off-line"></i>
                    </div>
                  )}
                  <div className="video-label">You (Interviewer)</div>
                </div>
              </div>

              <div className="call-controls">
                <button disabled={ended} className={`control-btn ${!isAudioEnabled ? 'off' : ''}`} onClick={toggleAudio} title={isAudioEnabled ? 'Mute' : 'Unmute'}>
                  <i className={isAudioEnabled ? 'ri-mic-line' : 'ri-mic-off-line'}></i>
                </button>
                <button disabled={ended} className={`control-btn ${!isVideoEnabled ? 'off' : ''}`} onClick={toggleVideo} title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
                  <i className={isVideoEnabled ? 'ri-camera-line' : 'ri-camera-off-line'}></i>
                </button>
                <button 
                  className={`control-btn ${isRecording ? 'recording' : ''}`} 
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                  disabled={recordingUploading || hasPendingRecording || (!isRecording && (!isConnected || ended))}
                >
                  <i className={isRecording ? 'ri-stop-circle-line' : 'ri-record-circle-line'}></i>
                </button>
                <button disabled={ended} className="control-btn" title="Reconnect interview" onClick={() => { if (socketRef.current?.connected) callRef.current?.recover(); else void socketRef.current?.connect(); }}><i className="ri-refresh-line" /></button>
                <button disabled={ended} className="control-btn end-call" onClick={() => setShowEndCallConfirm(true)} title="End interview">
                  <i className="ri-phone-line"></i>
                </button>
              </div>
              <div className="interview-recording-state" role="status">
                {isRecording && <span>Recording both participants</span>}
                {recordingUploading && <span>Saving recording...</span>}
                {hasPendingRecording && !recordingUploading && <button onClick={() => { void uploadRecording(); }}><i aria-hidden="true" className="ri-upload-2-line" />Retry recording upload</button>}
                {recordingUrl && <details><summary>Saved recording</summary><video controls crossOrigin="use-credentials" src={`${API_BASE_URL}${recordingUrl}`} /></details>}
              </div>
            </div>

            <div className="notes-section">
              <div className="notes-header">
                <h3><i className="ri-file-text-line"></i> Interview Notes</h3>
              </div>
              {room?.result ? <div className="result-section"><h3>Final result: {room.result === 'pass' ? 'Passed' : 'Failed'}</h3><a href="/interviews">Back to interviews</a></div> : <>

              {/* Rubric Scoring */}
              <div className="rubric-section">
                <h4><i className="ri-star-line"></i> Evaluation Rubric</h4>
                <div className="rubric-grid">
                  {rubricCategories.map(({ key, label, icon }) => (
                    <div key={key} className="rubric-item">
                      <div className="rubric-label">
                        <i className={icon}></i>
                        <span>{label}</span>
                      </div>
                      <div className="rubric-scores">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            className={`score-btn ${rubricScores[key as keyof RubricScores] === score ? 'active' : ''}`}
                            onClick={() => updateRubricScore(key as keyof RubricScores, score)}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rubric-average">
                  <span>Average Score:</span>
                  <strong>{calculateAverageScore()}/5</strong>
                </div>
              </div>

              {/* Timestamp Notes */}
              <div className="timestamp-section">
                <h4><i className="ri-time-line"></i> Timestamped Notes</h4>
                <div className="timestamp-notes-list">
                  {timestampNotes.map((note, index) => (
                    <div key={index} className="timestamp-note">
                      <span className="timestamp">[{note.time}]</span>
                      <span className="note-text">{note.note}</span>
                    </div>
                  ))}
                </div>
                <div className="note-input-area">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
                    placeholder="Type a note and press Add to timestamp it..."
                    rows={3}
                  />
                  <button className="btn-add-note" onClick={addTimestampNote} disabled={!notes.trim()}>
                    <i className="ri-add-line"></i> Add [{formatCurrentTime()}]
                  </button>
                </div>
              </div>

              {/* Pass/Fail Buttons */}
              <div className="result-section">
                <h4><i className="ri-checkbox-circle-line"></i> Interview Result</h4>
                <div className="result-buttons">
                  <button 
                    className="btn-result btn-pass"
                    onClick={() => setShowPassConfirm(true)}
                    disabled={isSaving || recordingUploading || Boolean(room?.result)}
                  >
                    <i className="ri-checkbox-circle-fill"></i>
                    {isSaving ? 'Submitting...' : 'Pass'}
                  </button>
                  <button 
                    className="btn-result btn-fail"
                    onClick={() => setShowFailConfirm(true)}
                    disabled={isSaving || recordingUploading || Boolean(room?.result)}
                  >
                    <i className="ri-close-circle-fill"></i>
                    {isSaving ? 'Submitting...' : 'Fail'}
                  </button>
                </div>
                <p className="result-hint">
                  <i className="ri-information-line"></i>
                  Submitting will end the interview and save all notes & scores
                </p>
              </div>
              </>}
            </div>
          </div>

          {error && (
            <div className="call-error">
              <i className="ri-error-warning-line"></i>
              {error}
              <button onClick={() => setError(null)}><i className="ri-close-line"></i></button>
            </div>
          )}
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndCallConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowEndCallConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon warning">
              <i className="ri-phone-off-line"></i>
            </div>
            <h3>End Interview?</h3>
            <p>Are you sure you want to end this interview? You can still submit the result afterwards.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowEndCallConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm danger" onClick={() => {
                setShowEndCallConfirm(false);
                handleEndCall();
              }}>
                End Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pass Confirmation Modal */}
      {showPassConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowPassConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon success">
              <i className="ri-checkbox-circle-line"></i>
            </div>
            <h3>Pass This Candidate?</h3>
            <p>This will mark the interview as passed and certify the tutor if they've completed all other requirements. This action cannot be undone.</p>
            <div className="rubric-summary">
              <span>Average Score: <strong>{(Object.values(rubricScores).reduce((a, b) => a + b, 0) / 5).toFixed(1)}/5</strong></span>
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowPassConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm success" onClick={() => {
                setShowPassConfirm(false);
                submitResult('pass');
              }}>
                Confirm Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fail Confirmation Modal */}
      {showFailConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowFailConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon danger">
              <i className="ri-close-circle-line"></i>
            </div>
            <h3>Fail This Candidate?</h3>
            <p>This will mark the interview as failed. The tutor will not be certified. This action cannot be undone.</p>
            <div className="rubric-summary">
              <span>Average Score: <strong>{(Object.values(rubricScores).reduce((a, b) => a + b, 0) / 5).toFixed(1)}/5</strong></span>
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowFailConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm danger" onClick={() => {
                setShowFailConfirm(false);
                submitResult('fail');
              }}>
                Confirm Fail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoomPage;
