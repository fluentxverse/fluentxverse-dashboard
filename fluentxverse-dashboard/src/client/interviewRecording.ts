export class InterviewRecording {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private context: AudioContext;
  private sources: MediaStreamAudioSourceNode[] = [];
  private videos: HTMLVideoElement[] = [];
  private timer: ReturnType<typeof setInterval>;
  private limit: ReturnType<typeof setTimeout>;
  private output: MediaStream;
  private stopped?: Promise<Blob>;

  constructor(local: MediaStream, remote: MediaStream, onLimit: () => void) {
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw Error('Recording is not supported in this browser. Use Chrome or Edge.');
    this.context = new AudioContext();
    void this.context.resume();
    const audio = this.context.createMediaStreamDestination();
    for (const stream of [local, remote]) {
      if (stream.getAudioTracks().length) {
        const source = this.context.createMediaStreamSource(stream);
        source.connect(audio); this.sources.push(source);
      }
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      void video.play().catch(() => {}); this.videos.push(video);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 960, 540);
      this.videos.forEach((video, index) => {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const scale = Math.min(480 / video.videoWidth, 480 / video.videoHeight);
          const width = video.videoWidth * scale, height = video.videoHeight * scale;
          ctx.drawImage(video, index * 480 + (480 - width) / 2, 30 + (480 - height) / 2, width, height);
        }
        ctx.fillStyle = '#ffffff'; ctx.font = '16px sans-serif';
        ctx.fillText(index ? 'Candidate' : 'Interviewer', index * 480 + 16, 525);
      });
    };
    draw(); this.timer = setInterval(draw, 100);
    this.output = new MediaStream([...canvas.captureStream(10).getVideoTracks(), ...audio.stream.getAudioTracks()]);
    this.recorder = new MediaRecorder(this.output, { mimeType, videoBitsPerSecond: 320000, audioBitsPerSecond: 64000 });
    this.recorder.ondataavailable = event => {
      if (event.data.size) this.chunks.push(event.data);
      if (this.chunks.reduce((size, chunk) => size + chunk.size, 0) > 85 * 1024 * 1024) onLimit();
    };
    this.recorder.onerror = () => onLimit();
    this.recorder.start(1000);
    this.limit = setTimeout(onLimit, 30 * 60 * 1000);
  }

  stop(): Promise<Blob> {
    if (this.stopped) return this.stopped;
    this.stopped = new Promise(resolve => {
      const finish = () => {
        clearInterval(this.timer); clearTimeout(this.limit);
        this.sources.forEach(source => source.disconnect());
        this.videos.forEach(video => { video.pause(); video.srcObject = null; });
        this.output.getTracks().forEach(track => track.stop());
        void this.context.close();
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType.split(';')[0] });
        this.chunks = []; resolve(blob);
      };
      this.recorder.onstop = finish;
      if (this.recorder.state === 'inactive') finish(); else this.recorder.stop();
    });
    return this.stopped;
  }
}
