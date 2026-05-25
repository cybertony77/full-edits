import { useMemo, useRef, useState } from 'react';
import VideoWatermarkOverlay from './VideoWatermarkOverlay';
import { buildZoomVideoProxyPath } from '../lib/zoomUtils';

export default function ZoomVideoPlayer({
  meetingId,
  onMilestonePercent,
  onComplete,
  videoId,
  watermarkText,
}) {
  const hasMilestoneRef = useRef(false);
  const hasCompleteRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const src = useMemo(() => {
    const base = buildZoomVideoProxyPath(meetingId);
    if (!base) return '';
    // Cache-bust query param so browsers never reuse an expired segment response
    return retryNonce ? `${base}?_=${retryNonce}` : base;
  }, [meetingId, retryNonce]);

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    if (!video.duration) return;
    const percent = (video.currentTime / video.duration) * 100;

    if (!hasMilestoneRef.current && percent >= 10 && onMilestonePercent) {
      hasMilestoneRef.current = true;
      onMilestonePercent(videoId, percent);
    }

    if (!hasCompleteRef.current && percent >= 90 && onComplete) {
      hasCompleteRef.current = true;
      onComplete(videoId, percent);
    }
  };

  const handleVideoError = () => {
    setRetryNonce((n) => n + 1);
  };

  if (!meetingId) {
    return (
      <div style={{ color: '#fff', padding: '32px', textAlign: 'center' }}>
        No Zoom meeting ID provided
      </div>
    );
  }

  if (!src) {
    return (
      <div style={{ color: '#fff', padding: '32px', textAlign: 'center' }}>
        Invalid Zoom recording link — please re-select the recording from the list
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '100vh',
        position: 'relative',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      <video
        key={src}
        src={src}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        playsInline
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '100vh',
          aspectRatio: '16 / 9',
          backgroundColor: '#000',
          outline: 'none',
          display: 'block',
        }}
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
      />
      <VideoWatermarkOverlay text={watermarkText} />
    </div>
  );
}
