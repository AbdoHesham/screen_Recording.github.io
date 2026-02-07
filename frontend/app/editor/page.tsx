'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FaFilm,
  FaMagic,
  FaCut,
  FaCloudUploadAlt,
  FaPlay,
  FaPause,
  FaStepBackward,
  FaStepForward,
} from 'react-icons/fa';
import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type EditorStatus = 'idle' | 'loading' | 'ready' | 'exporting' | 'error';
type Segment = { id: string; start: number; end: number };
type Marker = { id: string; time: number };
type TimelineSegment = Segment & { virtual?: boolean };
type DragState = { type: 'move' | 'resize-left' | 'resize-right'; segmentId: string; grabOffset: number };

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function VideoEditorPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ffmpegRef = useRef<FFmpegType | null>(null);
  const ffmpegReadyRef = useRef<boolean>(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<EditorStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [ffmpegReady, setFfmpegReady] = useState<boolean>(false);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStateRef = useRef<DragState | null>(null);

  const [exportUrl, setExportUrl] = useState<string>('');
  const [exportName, setExportName] = useState<string>('');
  const [lastAction, setLastAction] = useState<string>('None');

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    };
  }, [videoUrl, exportUrl]);

  useEffect(() => {
    const { sequenceDuration } = getTimelineMeta();
    if (sequenceDuration && currentTime > sequenceDuration) {
      setCurrentTime(sequenceDuration);
    }
  }, [segments, trimStart, trimEnd, zoom]);

  const minClipDuration = 0.2;
  const snapThreshold = 0.2;
  const basePixelsPerSecond = 60;

  const getTimelineSegments = (): TimelineSegment[] => {
    if (segments.length) return segments;
    if (trimEnd > trimStart) {
      return [{ id: 'trim', start: trimStart, end: trimEnd, virtual: true }];
    }
    return [];
  };

  const getTimelineMeta = () => {
    const timelineSegments = getTimelineSegments();
    const segmentOffsets: number[] = [];
    let acc = 0;
    timelineSegments.forEach((segment) => {
      segmentOffsets.push(acc);
      acc += Math.max(segment.end - segment.start, 0);
    });
    const sequenceDuration = acc;
    const pixelsPerSecond = basePixelsPerSecond * zoom;
    const timelineWidth = Math.max(900, sequenceDuration * pixelsPerSecond);
    return { timelineSegments, segmentOffsets, sequenceDuration, pixelsPerSecond, timelineWidth };
  };

  const getSegmentAtSequenceTime = (time: number) => {
    const { timelineSegments, segmentOffsets } = getTimelineMeta();
    for (let i = 0; i < timelineSegments.length; i += 1) {
      const segment = timelineSegments[i];
      const start = segmentOffsets[i];
      const duration = segment.end - segment.start;
      if (time <= start + duration || i === timelineSegments.length - 1) {
        const offset = Math.min(Math.max(time - start, 0), duration);
        return { segment, index: i, sequenceStart: start, offset };
      }
    }
    return null;
  };

  const getSegmentBySourceTime = (time: number) => {
    const { timelineSegments, segmentOffsets } = getTimelineMeta();
    for (let i = 0; i < timelineSegments.length; i += 1) {
      const segment = timelineSegments[i];
      if (time >= segment.start && time <= segment.end) {
        return { segment, index: i, sequenceStart: segmentOffsets[i] };
      }
    }
    return null;
  };

  const getPointerSequenceTime = (clientX: number) => {
    const { sequenceDuration, pixelsPerSecond } = getTimelineMeta();
    if (!timelineScrollRef.current || !pixelsPerSecond) return 0;
    const rect = timelineScrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + timelineScrollRef.current.scrollLeft;
    const raw = x / pixelsPerSecond;
    return Math.min(Math.max(raw, 0), sequenceDuration);
  };

  const snapToTargets = (value: number) => {
    const targets = [currentTime, ...markers.map((marker) => marker.time)];
    for (const target of targets) {
      if (Math.abs(value - target) <= snapThreshold) {
        return target;
      }
    }
    return value;
  };

  const ensureFFmpeg = async () => {
    if (ffmpegReadyRef.current) return;
    if (typeof window === 'undefined') {
      setStatus('error');
      setStatusMessage('FFmpeg can only load in the browser.');
      return;
    }
    setStatus('loading');
    setStatusMessage('Loading editor engine...');
    try {
      if (!ffmpegRef.current) {
        const ffmpegModule = await import('@ffmpeg/ffmpeg');
        const FFmpegCtor =
          (ffmpegModule as any).FFmpeg ||
          (ffmpegModule as any).default?.FFmpeg ||
          (ffmpegModule as any).default?.FFmpegWASM?.FFmpeg;
        if (!FFmpegCtor) {
          throw new Error('FFmpeg constructor not found');
        }
        ffmpegRef.current = new FFmpegCtor();
      }
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('progress', ({ progress: ratio }) => {
        setProgress(Math.min(99, Math.round(ratio * 100)));
      });

      const loadCoreFromUrl = async (baseURL: string) => {
        await ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
      };

      const localBaseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/ffmpeg`
        : '/ffmpeg';

      const localCore = `${localBaseUrl}/ffmpeg-core.js`;
      const localWasm = `${localBaseUrl}/ffmpeg-core.wasm`;

      const localCoreRes = await fetch(localCore, { method: 'HEAD' });
      const localWasmRes = await fetch(localWasm, { method: 'HEAD' });

      if (!localCoreRes.ok || !localWasmRes.ok) {
        throw new Error('Local FFmpeg core not found in /public/ffmpeg');
      }

      await loadCoreFromUrl(localBaseUrl);
      ffmpegReadyRef.current = true;
      setFfmpegReady(true);
      setStatus('ready');
      setStatusMessage('Editor ready.');
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      ffmpegReadyRef.current = false;
      setFfmpegReady(false);
      setStatus('error');
      setStatusMessage('Failed to load editor engine. Run node scripts/copy-ffmpeg-core.js in frontend.');
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const loadFile = (selected: File) => {
    if (!selected.type.startsWith('video/')) {
      setStatus('error');
      setStatusMessage('Please select a valid video file.');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl('');
    setExportName('');
    setFile(selected);
    setVideoUrl(URL.createObjectURL(selected));
    setIsPlaying(false);
    setStatus('idle');
    setStatusMessage('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      loadFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) loadFile(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const videoDuration = videoRef.current.duration || 0;
    setDuration(videoDuration);
    setTrimStart(0);
    setTrimEnd(videoDuration);
    setCurrentTime(0);
    setZoom(1);
    setSegments([]);
    setMarkers([]);
  };

  const handleSetIn = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const safeCurrent = Math.min(current, trimEnd - minClipDuration);
    setTrimStart(Math.max(0, safeCurrent));
  };

  const handleSetOut = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const safeCurrent = Math.max(current, trimStart + minClipDuration);
    setTrimEnd(Math.min(duration, safeCurrent));
  };

  const handleStartChange = (value: number) => {
    const safeValue = Math.min(value, trimEnd - minClipDuration);
    setTrimStart(Math.max(0, safeValue));
  };

  const handleEndChange = (value: number) => {
    const safeValue = Math.max(value, trimStart + minClipDuration);
    setTrimEnd(Math.min(duration, safeValue));
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      const segmentInfo = getSegmentAtSequenceTime(currentTime);
      if (!segmentInfo) return;
      videoRef.current.currentTime = segmentInfo.segment.start + segmentInfo.offset;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleJump = (seconds: number) => {
    if (!videoRef.current) return;
    const { sequenceDuration } = getTimelineMeta();
    if (!sequenceDuration) return;
    const target = Math.min(Math.max(0, currentTime + seconds), sequenceDuration);
    setCurrentTime(target);
    const segmentInfo = getSegmentAtSequenceTime(target);
    if (segmentInfo) {
      videoRef.current.currentTime = segmentInfo.segment.start + segmentInfo.offset;
    }
  };

  const handlePlayInOut = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    videoRef.current.play();
    setIsPlaying(true);
    const stopAt = trimEnd;
    const interval = setInterval(() => {
      if (!videoRef.current) return;
      if (videoRef.current.currentTime >= stopAt) {
        videoRef.current.pause();
        setIsPlaying(false);
        clearInterval(interval);
      }
    }, 100);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const sourceTime = videoRef.current.currentTime;
    const segmentInfo = getSegmentBySourceTime(sourceTime);
    if (!segmentInfo) return;
    const seqTime = segmentInfo.sequenceStart + (sourceTime - segmentInfo.segment.start);
    setCurrentTime(seqTime);

    if (isPlaying) {
      if (sourceTime >= segmentInfo.segment.end - 0.03) {
        const { timelineSegments } = getTimelineMeta();
        const nextIndex = segmentInfo.index + 1;
        if (timelineSegments[nextIndex]) {
          videoRef.current.currentTime = timelineSegments[nextIndex].start;
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !timelineScrollRef.current || !videoRef.current) return;
    const { sequenceDuration } = getTimelineMeta();
    if (!sequenceDuration) return;
    const seqTime = getPointerSequenceTime(e.clientX);
    setCurrentTime(seqTime);
    const segmentInfo = getSegmentAtSequenceTime(seqTime);
    if (segmentInfo) {
      videoRef.current.currentTime = segmentInfo.segment.start + segmentInfo.offset;
    }
  };

  const handleAddSegment = () => {
    const clipDuration = trimEnd - trimStart;
    if (!duration || clipDuration <= minClipDuration) return;
    const newSegment: Segment = {
      id: `${Date.now()}-${Math.random()}`,
      start: trimStart,
      end: trimEnd,
    };
    setSegments((prev) => [...prev, newSegment]);
  };

  const handleRemoveSegment = (id: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== id));
    setSelectedSegmentId((prev) => (prev === id ? null : prev));
  };

  const handleClearSegments = () => {
    setSegments([]);
    setSelectedSegmentId(null);
  };

  const handleSplitSegment = () => {
    const segmentInfo = getSegmentAtSequenceTime(currentTime);
    if (!segmentInfo) return;
    const splitSourceTime = segmentInfo.segment.start + segmentInfo.offset;

    if (segmentInfo.segment.virtual) {
      if (splitSourceTime - trimStart < minClipDuration || trimEnd - splitSourceTime < minClipDuration) return;
      setSegments([
        { id: `${Date.now()}-a`, start: trimStart, end: splitSourceTime },
        { id: `${Date.now()}-b`, start: splitSourceTime, end: trimEnd },
      ]);
      return;
    }

    setSegments((prev) => {
      const index = prev.findIndex((segment) => segment.id === segmentInfo.segment.id);
      if (index < 0) return prev;
      const target = prev[index];
      if (splitSourceTime - target.start < minClipDuration || target.end - splitSourceTime < minClipDuration) {
        return prev;
      }
      const next = [...prev];
      next.splice(index, 1,
        { id: `${Date.now()}-a`, start: target.start, end: splitSourceTime },
        { id: `${Date.now()}-b`, start: splitSourceTime, end: target.end }
      );
      return next;
    });
  };

  const handleAddMarker = () => {
    if (!duration) return;
    setMarkers((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, time: currentTime },
    ]);
  };

  const handleClearMarkers = () => {
    setMarkers([]);
  };

  const startDrag = (state: DragState) => {
    dragStateRef.current = state;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      if (!segments.length) return;

      const { timelineSegments, segmentOffsets, sequenceDuration, pixelsPerSecond } = getTimelineMeta();
      if (!sequenceDuration || !pixelsPerSecond) return;

      const pointerSeq = getPointerSequenceTime(event.clientX);
      const segmentIndex = segments.findIndex((segment) => segment.id === dragState.segmentId);
      if (segmentIndex < 0) return;

      const segment = segments[segmentIndex];
      const segmentDuration = segment.end - segment.start;
      const segmentSequenceStart = segmentOffsets[segmentIndex] ?? 0;

      if (dragState.type === 'move') {
        let newStart = pointerSeq - dragState.grabOffset;
        newStart = Math.min(Math.max(0, newStart), Math.max(0, sequenceDuration - segmentDuration));
        newStart = snapToTargets(newStart);
        const targetCenter = newStart + segmentDuration / 2;

        let targetIndex = 0;
        let acc = 0;
        for (let i = 0; i < timelineSegments.length; i += 1) {
          const duration = timelineSegments[i].end - timelineSegments[i].start;
          if (targetCenter <= acc + duration || i === timelineSegments.length - 1) {
            targetIndex = i;
            break;
          }
          acc += duration;
        }

        if (targetIndex !== segmentIndex) {
          setSegments((prev) => {
            const updated = [...prev];
            const [item] = updated.splice(segmentIndex, 1);
            updated.splice(targetIndex, 0, item);
            return updated;
          });
        }
        return;
      }

      if (dragState.type === 'resize-left') {
        const snappedSeqStart = snapToTargets(pointerSeq);
        const deltaSeq = snappedSeqStart - segmentSequenceStart;
        let newStart = segment.start + deltaSeq;
        newStart = Math.max(0, Math.min(newStart, segment.end - minClipDuration));
        setSegments((prev) =>
          prev.map((item) =>
            item.id === segment.id ? { ...item, start: newStart } : item
          )
        );
        return;
      }

      if (dragState.type === 'resize-right') {
        const snappedSeqEnd = snapToTargets(pointerSeq);
        let newDuration = snappedSeqEnd - segmentSequenceStart;
        newDuration = Math.max(minClipDuration, newDuration);
        let newEnd = segment.start + newDuration;
        newEnd = Math.min(duration, newEnd);
        if (newEnd - segment.start < minClipDuration) {
          newEnd = segment.start + minClipDuration;
        }
        setSegments((prev) =>
          prev.map((item) =>
            item.id === segment.id ? { ...item, end: newEnd } : item
          )
        );
      }
    };

    const handleUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setIsDragging(false);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [segments, duration, trimStart, trimEnd, zoom, currentTime, markers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        handlePlayPause();
      }
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        handleSplitSegment();
      }
      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        handleSetIn();
      }
      if (event.key === 'o' || event.key === 'O') {
        event.preventDefault();
        handleSetOut();
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        handleAddMarker();
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSegmentId) {
        event.preventDefault();
        handleRemoveSegment(selectedSegmentId);
        setSelectedSegmentId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSegmentId, currentTime, segments, trimStart, trimEnd, duration]);

  const handleExport = async () => {
    setLastAction(`Export clicked @ ${new Date().toLocaleTimeString()}`);
    if (!file) {
      setStatus('error');
      setStatusMessage('Please import a video first.');
      return;
    }
    if (!duration) {
      setStatus('error');
      setStatusMessage('Video metadata not loaded yet. Wait for preview or press Play once.');
      return;
    }
    setStatus('loading');
    setStatusMessage('Preparing export...');
    await ensureFFmpeg();
    if (!ffmpegRef.current || !ffmpegReadyRef.current) {
      setStatus('error');
      setStatusMessage('FFmpeg failed to load. Disable Turbopack or check your network.');
      return;
    }

    const exportSegments = segments.length
      ? segments.map((segment) => ({ ...segment })).sort((a, b) => a.start - b.start)
      : [{ id: 'single', start: trimStart, end: trimEnd }];
    const totalDuration = exportSegments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
    if (totalDuration <= 0.1) {
      setStatus('error');
      setStatusMessage('Trim range is too small.');
      return;
    }

    setStatus('exporting');
    setStatusMessage('Exporting trimmed video...');
    setProgress(0);

    try {
      const extFromName = file.name.split('.').pop()?.toLowerCase();
      const isWebm = file.type.includes('webm') || extFromName === 'webm';
      const ext = isWebm ? 'webm' : 'mp4';
      const inputName = `input.${ext}`;
      const outputName = `trimmed.${ext}`;

      await ffmpegRef.current.writeFile(inputName, await fetchFile(file));

      if (exportSegments.length === 1) {
        await ffmpegRef.current.exec([
          '-ss',
          exportSegments[0].start.toFixed(3),
          '-t',
          (exportSegments[0].end - exportSegments[0].start).toFixed(3),
          '-i',
          inputName,
          '-c',
          'copy',
          outputName,
        ]);
      } else {
        for (let i = 0; i < exportSegments.length; i += 1) {
          const segment = exportSegments[i];
          const segmentName = `seg-${i}.${ext}`;
          await ffmpegRef.current.exec([
            '-ss',
            segment.start.toFixed(3),
            '-t',
            (segment.end - segment.start).toFixed(3),
            '-i',
            inputName,
            '-c',
            'copy',
            segmentName,
          ]);
        }
        const concatList = exportSegments
          .map((_, i) => `file seg-${i}.${ext}`)
          .join('\n');
        await ffmpegRef.current.writeFile('concat.txt', concatList);
        await ffmpegRef.current.exec([
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          'concat.txt',
          '-c',
          'copy',
          outputName,
        ]);
      }

      const data = await ffmpegRef.current.readFile(outputName);
      const blob = new Blob([data as Uint8Array], { type: file.type || 'video/mp4' });
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportName(`trimmed-${file.name}`);
      setStatus('ready');
      setStatusMessage('Export complete.');
      setProgress(100);
    } catch (err) {
      console.error('Export failed:', err);
      setStatus('error');
      setStatusMessage('Export failed. Try a different file.');
    }
  };

  const timelineMeta = getTimelineMeta();
  const { timelineSegments, segmentOffsets, sequenceDuration, pixelsPerSecond, timelineWidth } = timelineMeta;

  const statusLabel = status === 'exporting'
    ? `Exporting ${progress}%`
    : status === 'loading'
    ? 'Loading engine'
    : statusMessage
    ? statusMessage
    : !ffmpegReady && file
    ? 'Engine not loaded'
    : file
    ? 'Ready'
    : 'Import a video';

  const statusDot = status === 'error'
    ? 'bg-red-500'
    : status === 'exporting'
    ? 'bg-amber-500'
    : status === 'loading'
    ? 'bg-blue-500'
    : 'bg-emerald-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <FaFilm className="text-white text-lg" />
            </div>
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400">ProScreen</div>
              <div className="text-lg font-semibold">Studio</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${statusDot}`}></span>
              <span>{statusLabel}</span>
            </div>
            <button
              onClick={handlePickFile}
              className="btn bg-slate-800 text-slate-100 hover:bg-slate-700 text-sm px-4 py-2"
            >
              Import
            </button>
            <button
              onClick={handleExport}
              disabled={!file || status === 'loading' || status === 'exporting'}
              className="btn bg-indigo-600 text-white hover:bg-indigo-500 text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export
            </button>
            <Link
              href="/"
              className="btn bg-slate-900 text-slate-300 hover:bg-slate-800 text-sm px-4 py-2"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[72px_1fr_320px] h-[calc(100vh-56px)]">
        <aside className="border-r border-slate-800 bg-slate-950/70">
          <div className="h-full flex flex-col items-center py-4 gap-3 text-xs text-slate-300">
            <button onClick={handlePickFile} className="flex flex-col items-center gap-2 hover:text-white">
              <FaCloudUploadAlt className="text-lg" />
              Import
            </button>
            <button onClick={handleSetIn} className="flex flex-col items-center gap-2 hover:text-white">
              <FaCut className="text-lg" />
              Set In
            </button>
            <button onClick={handleSetOut} className="flex flex-col items-center gap-2 hover:text-white">
              <FaCut className="text-lg" />
              Set Out
            </button>
            <button onClick={handleAddSegment} className="flex flex-col items-center gap-2 hover:text-white">
              <FaMagic className="text-lg" />
              Segment
            </button>
            <button onClick={handleSplitSegment} className="flex flex-col items-center gap-2 hover:text-white">
              <FaCut className="text-lg" />
              Split
            </button>
            <button onClick={handleAddMarker} className="flex flex-col items-center gap-2 hover:text-white">
              <FaFilm className="text-lg" />
              Marker
            </button>
          </div>
        </aside>

        <div className="flex flex-col min-w-0">
          <div className="flex-1 p-6 overflow-auto">
            <div
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.35)]"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {videoUrl ? (
                <div className="relative aspect-video bg-black/40 rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls={false}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-center">
                  <FaCloudUploadAlt className="text-4xl text-indigo-400 mb-3" />
                  <p className="text-sm text-slate-300">Drag and drop a video here</p>
                  <p className="text-xs text-slate-500">MP4 or WebM recommended</p>
                  <button
                    onClick={handlePickFile}
                    className="mt-4 btn bg-indigo-600 text-white hover:bg-indigo-500 text-sm px-5 py-2"
                  >
                    Choose Video
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {videoUrl && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Timecode {formatTime(currentTime)} / {formatTime(sequenceDuration)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handleJump(-5)} className="btn bg-slate-800 text-slate-100 hover:bg-slate-700 text-xs px-3 py-2">
                      <FaStepBackward /> -5s
                    </button>
                    <button onClick={handlePlayPause} className="btn bg-indigo-600 text-white hover:bg-indigo-500 text-xs px-3 py-2">
                      {isPlaying ? <FaPause /> : <FaPlay />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={() => handleJump(5)} className="btn bg-slate-800 text-slate-100 hover:bg-slate-700 text-xs px-3 py-2">
                      +5s <FaStepForward />
                    </button>
                    <button onClick={handlePlayInOut} className="btn bg-slate-900 text-slate-100 hover:bg-slate-800 text-xs px-3 py-2">
                      Play In/Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-slate-200">Timeline</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span>{zoom.toFixed(1)}x</span>
              </div>
            </div>

            <div
              ref={timelineScrollRef}
              className={`relative h-28 overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
              onClick={handleTimelineClick}
            >
              <div
                ref={timelineRef}
                className="relative h-full"
                style={{
                  width: `${timelineWidth}px`,
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-6 border-b border-slate-800 text-[10px] text-slate-500">
                  {sequenceDuration > 0 &&
                    Array.from({ length: Math.ceil(sequenceDuration / 5) + 1 }).map((_, idx) => {
                      const time = idx * 5;
                      if (time > sequenceDuration) return null;
                      const left = time * pixelsPerSecond;
                      return (
                        <div
                          key={`tick-${time}`}
                          className="absolute top-0 h-full border-l border-slate-800"
                          style={{ left: `${left}px` }}
                        >
                          <div className="translate-x-1">{formatTime(time)}</div>
                        </div>
                      );
                    })}
                </div>

                <div className="absolute left-0 right-0 top-6 bottom-0">
                  {sequenceDuration > 0 &&
                    timelineSegments.map((segment, index) => {
                      const left = segmentOffsets[index] * pixelsPerSecond;
                      const width = (segment.end - segment.start) * pixelsPerSecond;
                      return (
                        <div
                          key={segment.id}
                          className={`absolute top-6 h-12 rounded-md border shadow-sm ${
                            segment.virtual
                              ? 'bg-emerald-500/70 border-emerald-600'
                              : selectedSegmentId === segment.id
                              ? 'bg-indigo-500/90 border-indigo-300 ring-2 ring-indigo-200/60'
                              : 'bg-indigo-500/80 border-indigo-600'
                          }`}
                          style={{ left: `${left}px`, width: `${width}px` }}
                          onPointerDown={(event) => {
                            if (segment.virtual) return;
                            event.stopPropagation();
                            setSelectedSegmentId(segment.id);
                            const pointerSeq = getPointerSequenceTime(event.clientX);
                            const grabOffset = pointerSeq - segmentOffsets[index];
                            startDrag({ type: 'move', segmentId: segment.id, grabOffset });
                          }}
                        >
                          <div className="px-2 py-1 text-[10px] text-white truncate">
                            {formatTime(segment.start)} - {formatTime(segment.end)}
                          </div>
                          {!segment.virtual && (
                            <>
                              <div
                                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/20"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  setSelectedSegmentId(segment.id);
                                  startDrag({ type: 'resize-left', segmentId: segment.id, grabOffset: 0 });
                                }}
                              />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  setSelectedSegmentId(segment.id);
                                  startDrag({ type: 'resize-right', segmentId: segment.id, grabOffset: 0 });
                                }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>

                {sequenceDuration > 0 &&
                  markers.map((marker) => {
                    const left = marker.time * pixelsPerSecond;
                    return (
                      <div
                        key={marker.id}
                        className="absolute top-0 h-full border-l-2 border-orange-400"
                        style={{ left: `${left}px` }}
                      />
                    );
                  })}

                {sequenceDuration > 0 && (
                  <div
                    className="absolute top-0 h-full border-l-2 border-red-500"
                    style={{ left: `${currentTime * pixelsPerSecond}px` }}
                  >
                    <div className="absolute -top-1 -left-2 w-3 h-3 bg-red-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button onClick={handleAddSegment} className="btn bg-indigo-600 text-white hover:bg-indigo-500 text-xs px-3 py-2">
                Add Segment
              </button>
              <button onClick={handleSplitSegment} className="btn bg-blue-600 text-white hover:bg-blue-500 text-xs px-3 py-2">
                Split
              </button>
              <button onClick={handleClearSegments} className="btn bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs px-3 py-2">
                Clear Segments
              </button>
              <button onClick={handleAddMarker} className="btn bg-orange-500 text-white hover:bg-orange-400 text-xs px-3 py-2">
                Add Marker
              </button>
              <button onClick={handleClearMarkers} className="btn bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs px-3 py-2">
                Clear Markers
              </button>
            </div>
          </div>
        </div>

        <aside className="border-l border-slate-800 bg-slate-950/80 p-4 overflow-y-auto space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Project</div>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>File</span>
                <span className="text-xs text-slate-400 truncate max-w-[150px]">{file ? file.name : 'None'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Duration</span>
                <span className="text-xs text-slate-400">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sequence</span>
                <span className="text-xs text-slate-400">{formatTime(sequenceDuration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Segments</span>
                <span className="text-xs text-slate-400">{segments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Markers</span>
                <span className="text-xs text-slate-400">{markers.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trim</div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Start</span>
                  <span>{formatTime(trimStart)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => handleStartChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>End</span>
                  <span>{formatTime(trimEnd)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => handleEndChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Clip Length</span>
                <span>{formatTime(trimEnd - trimStart)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Segments</div>
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {segments.length === 0 && (
                <div className="text-xs text-slate-500">No segments yet.</div>
              )}
              {segments.map((segment, index) => (
                <div key={segment.id} className="flex items-center justify-between text-xs text-slate-200 bg-slate-800/70 rounded-md px-2 py-2">
                  <span>
                    #{index + 1} {formatTime(segment.start)} to {formatTime(segment.end)}
                  </span>
                  <button
                    onClick={() => handleRemoveSegment(segment.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Export</div>
            <p className="text-xs text-slate-500 mt-3">
              Export uses segments if you added them, otherwise the trim range.
            </p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Engine</span>
                <span>{ffmpegReady ? 'Ready' : 'Not loaded'}</span>
              </div>
              {statusMessage && <div className="mt-1 text-slate-300">{statusMessage}</div>}
            </div>
            <button
              onClick={handleExport}
              disabled={!file || status === 'loading' || status === 'exporting'}
              className="mt-4 btn bg-indigo-600 text-white hover:bg-indigo-500 text-sm px-4 py-2 w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export Clip
            </button>
            {!file && (
              <div className="mt-2 text-xs text-slate-500">
                Import a video to enable export.
              </div>
            )}
            {status === 'exporting' && (
              <div className="mt-3 text-xs text-slate-400">Exporting... {progress}%</div>
            )}
            {exportUrl && (
              <a
                href={exportUrl}
                download={exportName || 'trimmed-video.mp4'}
                className="mt-3 btn bg-emerald-500 text-white hover:bg-emerald-400 text-sm px-4 py-2 w-full inline-flex"
              >
                Download Export
              </a>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400 space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Debug</div>
            <div className="flex items-center justify-between">
              <span>Last Action</span>
              <span className="text-slate-300">{lastAction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="text-slate-300">{status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Message</span>
              <span className="text-slate-300">{statusMessage || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Engine</span>
              <span className="text-slate-300">{ffmpegReady ? 'ready' : 'not-ready'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>File</span>
              <span className="text-slate-300">{file ? 'loaded' : 'none'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Duration</span>
              <span className="text-slate-300">{duration ? formatTime(duration) : '0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Segments</span>
              <span className="text-slate-300">{segments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Progress</span>
              <span className="text-slate-300">{progress}%</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
