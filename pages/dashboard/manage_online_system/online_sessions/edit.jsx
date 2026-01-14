import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../../components/GradeSelect';
import OnlineSessionPaymentStateSelect from '../../../../components/OnlineSessionPaymentStateSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// Extract week number from week string (e.g., "week 01" -> 1)
function extractWeekNumber(weekString) {
  if (!weekString) return null;
  const match = weekString.match(/week\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Convert week number to week string (e.g., 1 -> "week 01")
function weekNumberToString(weekNumber) {
  if (weekNumber === null || weekNumber === undefined) return '';
  return `week ${String(weekNumber).padStart(2, '0')}`;
}

export default function EditOnlineSession() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    videos: [{
      video_source: 'youtube',
      youtube_url: '',
      vdocipher_option: 'video_id',
      vdocipher_video_id: '',
      vdocipher_file: null,
      vdocipher_uploaded_video_id: null
    }]
  });
  const [selectedGrade, setSelectedGrade] = useState('');
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [paymentState, setPaymentState] = useState('paid');
  const [errors, setErrors] = useState({});
  const [uploadingVideos, setUploadingVideos] = useState({}); // Track upload progress: { videoIndex: percentage (0-100) }
  const [uploadedVideos, setUploadedVideos] = useState({}); // Track successfully uploaded videos: { videoIndex: true }
  const [videoPreviews, setVideoPreviews] = useState({});
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const errorTimeoutRef = useRef(null);

  // Fetch session data
  const { data: sessionsData } = useQuery({
    queryKey: ['online_sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_sessions');
      return response.data;
    },
  });

  const sessions = sessionsData?.sessions || [];
  const selectedSession = sessions.find(s => s._id === id);

  // Load session data when available
  useEffect(() => {
    if (selectedSession && isLoadingSession) {
      // Extract videos from session
      const videos = [];
      let videoIndex = 1;
      while (selectedSession[`video_ID_${videoIndex}`]) {
        const videoId = selectedSession[`video_ID_${videoIndex}`];
        const videoType = selectedSession[`video_type_${videoIndex}`] || 'youtube';
        
        if (videoType === 'youtube') {
          videos.push({
            video_source: 'youtube',
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            vdocipher_option: 'video_id',
            vdocipher_video_id: '',
            vdocipher_file: null,
            vdocipher_uploaded_video_id: null
          });
        } else if (videoType === 'vdocipher') {
          videos.push({
            video_source: 'vdocipher',
            youtube_url: '',
            vdocipher_option: 'video_id',
            vdocipher_video_id: videoId,
            vdocipher_file: null,
            vdocipher_uploaded_video_id: null
          });
        }
        videoIndex++;
      }

      setFormData({
        name: selectedSession.name || '',
        description: selectedSession.description || '',
        videos: videos.length > 0 ? videos : [{
          video_source: 'youtube',
          youtube_url: '',
          vdocipher_option: 'video_id',
          vdocipher_video_id: '',
          vdocipher_file: null,
          vdocipher_uploaded_video_id: null
        }]
      });
      setSelectedWeek(selectedSession.week ? weekNumberToString(selectedSession.week) : '');
      setSelectedGrade(selectedSession.grade || '');
      setPaymentState(selectedSession.payment_state || 'paid');
      setIsLoadingSession(false);
    }
  }, [selectedSession, isLoadingSession]);

  // Auto-hide errors after 6 seconds
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors({});
      }, 6000);
    }
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [errors]);

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.put(`/api/online_sessions?id=${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['online_sessions']);
      router.push('/dashboard/manage_online_system/online_sessions');
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to update session';
      setErrors({ general: errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}` });
    },
  });

  // Add video row
  const addVideo = () => {
    setFormData({
      ...formData,
      videos: [...formData.videos, {
        video_source: 'youtube',
        youtube_url: '',
        vdocipher_option: 'video_id',
        vdocipher_video_id: '',
        vdocipher_file: null,
        vdocipher_uploaded_video_id: null
      }]
    });
  };

  // Remove video row
  const removeVideo = (index) => {
    if (formData.videos.length > 1) {
      const newVideos = formData.videos.filter((_, i) => i !== index);
      setFormData({ ...formData, videos: newVideos });
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`video_${index}_`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  // Handle video source change
  const handleVideoSourceChange = (index, source) => {
    const newVideos = [...formData.videos];
    newVideos[index] = {
      ...newVideos[index],
      video_source: source,
      youtube_url: source === 'youtube' ? newVideos[index].youtube_url : '',
      vdocipher_option: source === 'vdocipher' ? newVideos[index].vdocipher_option : 'video_id',
      vdocipher_video_id: source === 'vdocipher' ? newVideos[index].vdocipher_video_id : '',
      vdocipher_file: source === 'vdocipher' ? newVideos[index].vdocipher_file : null
    };
    setFormData({ ...formData, videos: newVideos });
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`video_${index}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  // Handle VdoCipher option change
  const handleVdoCipherOptionChange = (index, option) => {
    const newVideos = [...formData.videos];
    newVideos[index] = {
      ...newVideos[index],
      vdocipher_option: option,
      vdocipher_video_id: option === 'video_id' ? newVideos[index].vdocipher_video_id : '',
      vdocipher_file: option === 'upload' ? newVideos[index].vdocipher_file : null
    };
    setFormData({ ...formData, videos: newVideos });
    const newErrors = { ...errors };
    if (newErrors[`video_${index}_vdocipher_video_id`]) {
      delete newErrors[`video_${index}_vdocipher_video_id`];
    }
    if (newErrors[`video_${index}_vdocipher_file`]) {
      delete newErrors[`video_${index}_vdocipher_file`];
    }
    setErrors(newErrors);
  };

  // Handle YouTube URL change
  const handleYouTubeUrlChange = (index, url) => {
    const newVideos = [...formData.videos];
    newVideos[index].youtube_url = url;
    setFormData({ ...formData, videos: newVideos });
    if (errors[`video_${index}_youtube_url`]) {
      const newErrors = { ...errors };
      delete newErrors[`video_${index}_youtube_url`];
      setErrors(newErrors);
    }
  };

  // Validate VdoCipher video ID exists
  const validateVdoCipherVideoId = async (videoId) => {
    if (!videoId || !videoId.trim()) {
      return { valid: false, error: 'Video ID is required' };
    }

    try {
      const response = await apiClient.post('/api/vdocipher/get-otp', { video_id: videoId.trim() });
      if (response.data && response.data.success) {
        return { valid: true, error: null };
      } else {
        return { valid: false, error: response.data?.error || 'Video validation failed' };
      }
    } catch (err) {
      // Handle 404 (video not found) and other errors
      if (err.response?.status === 404 || err.response?.data?.video_not_found) {
        return { valid: false, error: '❌ Video not found in VdoCipher. Please check if the video ID is correct.' };
      } else if (err.response?.data?.error) {
        return { valid: false, error: err.response.data.error };
      } else {
        return { valid: false, error: '❌ Failed to validate video. Please try again.' };
      }
    }
  };

  // Handle VdoCipher video ID change
  const handleVdoCipherVideoIdChange = (index, videoId) => {
    setFormData(prevFormData => {
      const newVideos = [...prevFormData.videos];
      newVideos[index] = {
        ...newVideos[index],
        vdocipher_video_id: videoId
      };
      return {
        ...prevFormData, // Preserve description and all other form fields
        videos: newVideos
      };
    });
    // Clear error
    if (errors[`video_${index}_vdocipher_video_id`]) {
      const newErrors = { ...errors };
      delete newErrors[`video_${index}_vdocipher_video_id`];
      setErrors(newErrors);
    }
  };

  // Handle VdoCipher file upload - starts upload immediately
  const handleVdoCipherFileChange = async (index, file) => {
    if (!file) {
      // Clear file using functional update to preserve description
      setFormData(prevFormData => {
        const newVideos = [...prevFormData.videos];
        newVideos[index] = {
          ...newVideos[index],
          vdocipher_file: null,
          vdocipher_uploaded_video_id: null
        };
        return {
          ...prevFormData, // Preserve description and all other form fields
          videos: newVideos
        };
      });
      setVideoPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[index];
        return newPreviews;
      });
      // Clear upload progress and uploaded status
      setUploadingVideos(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
      setUploadedVideos(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
      return;
    }

    // Validate file type (video files)
    if (!file.type.startsWith('video/')) {
      setErrors(prev => ({ ...prev, [`video_${index}_vdocipher_file`]: '❌ Please select a video file' }));
      return;
    }

    // Validate file size (500 MB max)
    if (file.size > 500 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [`video_${index}_vdocipher_file`]: '❌ Video file size must be less than 500 MB' }));
      return;
    }

    // Create preview using FileReader (creates data URL)
    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoPreviews(prev => ({ ...prev, [index]: reader.result }));
    };
    reader.readAsDataURL(file);

    // Store file object and clear previous upload ID using functional update to preserve description
    setFormData(prevFormData => {
      const newVideos = [...prevFormData.videos];
      newVideos[index] = {
        ...newVideos[index],
        vdocipher_file: file,
        vdocipher_uploaded_video_id: null // Clear previous upload
      };
      return {
        ...prevFormData, // Preserve description and all other form fields
        videos: newVideos
      };
    });
    
    // Clear previous uploaded status when selecting new file
    setUploadedVideos(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    
    // Clear error
    if (errors[`video_${index}_vdocipher_file`]) {
      const newErrors = { ...errors };
      delete newErrors[`video_${index}_vdocipher_file`];
      setErrors(newErrors);
    }

    // Start uploading immediately - same logic as add.jsx
    setUploadingVideos(prev => ({ ...prev, [index]: 0 }));
    
    let uploadProgressInterval;
    let startTime;
    let uploadComplete = false;
    
    try {
      const base64File = await fileToBase64(file, (progress) => {
        setUploadingVideos(prev => ({ ...prev, [index]: progress }));
      });
      
      const fileSizeMB = file.size / (1024 * 1024);
      const estimatedUploadSeconds = Math.max(3, Math.ceil(fileSizeMB * 1.5));
      const estimatedUploadMs = estimatedUploadSeconds * 1000;
      
      startTime = Date.now();
      let uploadProgress = 20;
      setUploadingVideos(prev => ({ ...prev, [index]: uploadProgress }));
      
      uploadProgressInterval = setInterval(() => {
        if (uploadComplete) {
          clearInterval(uploadProgressInterval);
          return;
        }
        
        const elapsed = Date.now() - startTime;
        const timeRatio = Math.min(elapsed / estimatedUploadMs, 1);
        const easedRatio = 1 - Math.pow(1 - timeRatio, 2);
        const calculatedProgress = 20 + (easedRatio * 78);
        
        const newProgress = Math.min(Math.round(calculatedProgress), 98);
        if (newProgress > uploadProgress) {
          uploadProgress = newProgress;
          setUploadingVideos(prev => ({ ...prev, [index]: uploadProgress }));
        }
      }, 150);
      
      const uploadResponse = await apiClient.post('/api/upload/vdocipher-video', {
        file: base64File,
        filename: file.name,
        fileType: file.type
      });

      uploadComplete = true;
      if (uploadProgressInterval) clearInterval(uploadProgressInterval);
      
      const currentProgress = uploadProgress;
      if (currentProgress < 98) {
        setUploadingVideos(prev => ({ ...prev, [index]: 98 }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setUploadingVideos(prev => ({ ...prev, [index]: 99 }));
      await new Promise(resolve => setTimeout(resolve, 150));
      setUploadingVideos(prev => ({ ...prev, [index]: 100 }));

      if (uploadResponse.data.success && uploadResponse.data.video_id) {
        // Store uploaded video ID in form data using functional update to preserve description and other fields
        setFormData(prevFormData => {
          const updatedVideos = [...prevFormData.videos];
          updatedVideos[index] = {
            ...updatedVideos[index], // Preserve all existing properties
            vdocipher_uploaded_video_id: uploadResponse.data.video_id
          };
          return {
            ...prevFormData, // Preserve description and all other form fields
            videos: updatedVideos
          };
        });
        
        // Mark as successfully uploaded (for permanent success message)
        setUploadedVideos(prev => ({ ...prev, [index]: true }));
        
        // Clear progress bar but keep success message
        setTimeout(() => {
          setUploadingVideos(prev => {
            const updated = { ...prev };
            delete updated[index];
            return updated;
          });
        }, 500);
      } else {
        throw new Error(uploadResponse.data.error || 'Upload failed');
      }
    } catch (err) {
      uploadComplete = true;
      if (uploadProgressInterval) clearInterval(uploadProgressInterval);
      setUploadingVideos(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
      setErrors(prev => ({ 
        ...prev, 
        [`video_${index}_vdocipher_file`]: err.response?.data?.error || '❌ Failed to upload video. Please try again.',
        general: err.response?.data?.error || '❌ Failed to upload video. Please try again.'
      }));
      
      // Clear the file from form data on error using functional update to preserve description
      setFormData(prevFormData => {
        const errorVideos = [...prevFormData.videos];
        errorVideos[index] = {
          ...errorVideos[index],
          vdocipher_file: null,
          vdocipher_uploaded_video_id: null
        };
        return {
          ...prevFormData, // Preserve description and all other form fields
          videos: errorVideos
        };
      });
      
      // Remove from uploaded videos if it was there
      setUploadedVideos(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    } finally {
      if (uploadProgressInterval) clearInterval(uploadProgressInterval);
    }
  };

  // Handle remove video
  const handleRemoveVideo = (index) => {
    // Clean up object URL if it exists
    const currentVideo = formData.videos[index];
    if (currentVideo?.vdocipher_file && !videoPreviews[index]) {
      // If we have a file but no preview, it means we're using URL.createObjectURL
      // We should clean it up, but since we create it inline, React will handle it
      // Still, we'll remove the file reference
    }
    
    // Clear file using functional update to preserve description
    setFormData(prevFormData => {
      const newVideos = [...prevFormData.videos];
      newVideos[index] = {
        ...newVideos[index],
        vdocipher_file: null,
        vdocipher_uploaded_video_id: null
      };
      return {
        ...prevFormData, // Preserve description and all other form fields
        videos: newVideos
      };
    });
    setVideoPreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[index];
      return newPreviews;
    });
    // Clear upload progress and uploaded status
    setUploadingVideos(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    setUploadedVideos(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleVdoCipherFileChange(index, file);
    }
  };

  // Convert file to base64 with progress tracking
  const fileToBase64 = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // Track progress during base64 conversion (0-20%)
      // Base64 conversion is usually fast, so we allocate less time for it
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentLoaded = Math.round((e.loaded / e.total) * 20);
          onProgress(Math.min(percentLoaded, 20)); // Cap at 20%
        }
      };
      
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (onProgress) onProgress(20); // Base64 conversion complete (20%)
        resolve(reader.result);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    if (errors.general) {
      setErrors({ ...errors, general: '' });
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Attendance week is required';
    }

    if (!paymentState || (paymentState !== 'paid' && paymentState !== 'free')) {
      newErrors.paymentState = '❌ Video Payment State is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = '❌ Name is required';
    }

    const validVideos = formData.videos.filter(video => {
      if (video.video_source === 'youtube') {
        return video.youtube_url && video.youtube_url.trim();
      } else if (video.video_source === 'vdocipher') {
        if (video.vdocipher_option === 'video_id') {
          return video.vdocipher_video_id && video.vdocipher_video_id.trim();
        } else if (video.vdocipher_option === 'upload') {
          // Video must be uploaded (have uploaded video ID) or currently uploading
          return video.vdocipher_uploaded_video_id !== null || uploadingVideos[formData.videos.indexOf(video)] !== undefined;
        }
      }
      return false;
    });

    if (validVideos.length === 0) {
      newErrors.videos = '❌ At least one valid video is required';
    }

    // Validate each video and check VdoCipher IDs exist (using for loop for async validation)
    for (let index = 0; index < formData.videos.length; index++) {
      const video = formData.videos[index];
      if (video.video_source === 'youtube') {
        if (video.youtube_url && video.youtube_url.trim()) {
          const videoId = extractYouTubeId(video.youtube_url.trim());
          if (!videoId) {
            newErrors[`video_${index}_youtube_url`] = '❌ Invalid YouTube URL';
          }
        } else if (validVideos.length === 0 || formData.videos.some((v, i) => i !== index && v.video_source === 'youtube' && v.youtube_url.trim())) {
          newErrors[`video_${index}_youtube_url`] = '❌ YouTube URL is required';
        }
      } else if (video.video_source === 'vdocipher') {
        if (video.vdocipher_option === 'video_id') {
          if (!video.vdocipher_video_id || !video.vdocipher_video_id.trim()) {
            newErrors[`video_${index}_vdocipher_video_id`] = '❌ VdoCipher Video ID is required';
          } else {
            // Validate that the video exists in VdoCipher
            try {
              const validation = await validateVdoCipherVideoId(video.vdocipher_video_id.trim());
              if (!validation.valid) {
                newErrors[`video_${index}_vdocipher_video_id`] = validation.error || '❌ Video not found in VdoCipher';
              }
            } catch (err) {
              newErrors[`video_${index}_vdocipher_video_id`] = '❌ Failed to validate video. Please try again.';
            }
          }
        } else if (video.vdocipher_option === 'upload') {
          // Check if video is currently uploading
          if (uploadingVideos[index] !== undefined && uploadingVideos[index] < 100) {
            newErrors[`video_${index}_vdocipher_file`] = '❌ Please wait for video upload to complete';
          } else if (!video.vdocipher_uploaded_video_id && !video.vdocipher_file) {
            newErrors[`video_${index}_vdocipher_file`] = '❌ Please select and upload a video file';
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const weekNumber = extractWeekNumber(selectedWeek);
    if (!weekNumber) {
      newErrors.week = '❌ Invalid week selection';
      setErrors(newErrors);
      return;
    }

    // Check for duplicate grade and week combination (exclude current session)
    const duplicateSession = sessions.find(
      session => session._id !== id && session.grade === selectedGrade.trim() && session.week === weekNumber
    );
    if (duplicateSession) {
      newErrors.general = '❌ A session with this grade and week already exists';
      setErrors(newErrors);
      return;
    }

    // Prepare video data for API - use already uploaded video IDs
    const videoData = [];

    for (let i = 0; i < formData.videos.length; i++) {
      const video = formData.videos[i];
      
      if (video.video_source === 'youtube' && video.youtube_url && video.youtube_url.trim()) {
        const videoId = extractYouTubeId(video.youtube_url.trim());
        if (videoId) {
          videoData.push({
            video_type: 'youtube',
            video_id: videoId
          });
        }
      } else if (video.video_source === 'vdocipher') {
        if (video.vdocipher_option === 'video_id' && video.vdocipher_video_id && video.vdocipher_video_id.trim()) {
          videoData.push({
            video_type: 'vdocipher',
            video_id: video.vdocipher_video_id.trim()
          });
        } else if (video.vdocipher_option === 'upload') {
          // Use already uploaded video ID
          if (video.vdocipher_uploaded_video_id) {
            videoData.push({
              video_type: 'vdocipher',
              video_id: video.vdocipher_uploaded_video_id
            });
          } else {
            // Video not uploaded yet, show error
            newErrors[`video_${i}_vdocipher_file`] = '❌ Video upload is not complete. Please wait for upload to finish.';
            setErrors(newErrors);
            return;
          }
        }
      }
    }

    // All videos are ready (either YouTube IDs or already uploaded VdoCipher IDs)
    const finalVideoData = videoData.map(video => ({
      video_type: video.video_type,
      video_id: video.video_id
    }));

    // Submit form
    updateSessionMutation.mutate({
      name: formData.name.trim(),
      grade: selectedGrade.trim(),
      week: weekNumber,
      videos: finalVideoData,
      description: formData.description.trim() || null,
      payment_state: paymentState
    });
  };

  if (isLoadingSession || !selectedSession) {
    return (
      <div className="page-wrapper" style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px" 
      }}>
        <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            Loading session data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system/online_sessions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/play-pause.svg" alt="Play Pause" width={32} height={32} />
            Edit Online Session
          </div>
        </Title>

        <div className="form-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <form onSubmit={handleSubmit}>
            {/* Video Grade */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Video Grade <span style={{ color: 'red' }}>*</span>
              </label>
              <GradeSelect
                selectedGrade={selectedGrade}
                onGradeChange={(grade) => {
                  setSelectedGrade(grade);
                  if (errors.grade) {
                    setErrors({ ...errors, grade: '' });
                  }
                }}
                isOpen={gradeDropdownOpen}
                onToggle={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                onClose={() => setGradeDropdownOpen(false)}
                required={true}
              />
              {errors.grade && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.grade}
                </div>
              )}
            </div>

            {/* Video Week */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Video Week <span style={{ color: 'red' }}>*</span>
              </label>
              <AttendanceWeekSelect
                selectedWeek={selectedWeek}
                onWeekChange={(week) => {
                  setSelectedWeek(week);
                  if (errors.week) {
                    setErrors({ ...errors, week: '' });
                  }
                }}
                isOpen={weekDropdownOpen}
                onToggle={() => setWeekDropdownOpen(!weekDropdownOpen)}
                onClose={() => setWeekDropdownOpen(false)}
                required={true}
                placeholder="Select Video Week"
              />
              {errors.week && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.week}
                </div>
              )}
            </div>

            {/* Video Payment State Radio */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                Video Payment State <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'paid' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'paid' ? '#f0f8ff' : 'white' }}>
                  <input
                    type="radio"
                    name="payment_state"
                    value="paid"
                    checked={paymentState === 'paid'}
                    onChange={(e) => {
                      setPaymentState(e.target.value);
                      if (errors.paymentState) {
                        setErrors({ ...errors, paymentState: '' });
                      }
                    }}
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>Paid</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'free' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'free' ? '#f0f8ff' : 'white' }}>
                  <input
                    type="radio"
                    name="payment_state"
                    value="free"
                    checked={paymentState === 'free'}
                    onChange={(e) => {
                      setPaymentState(e.target.value);
                      if (errors.paymentState) {
                        setErrors({ ...errors, paymentState: '' });
                      }
                    }}
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>Free</span>
                </label>
              </div>
              {errors.paymentState && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.paymentState}
                </div>
              )}
            </div>

            {/* Name Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter Session Name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: errors.name ? '2px solid #dc3545' : '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
              {errors.name && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.name}
                </div>
              )}
            </div>

            {/* Videos Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', color: '#333', fontWeight: '500' }}>
                Videos <span style={{ color: 'red' }}>*</span>
              </label>
              
              {formData.videos.map((video, index) => (
                <div key={index} style={{
                  marginBottom: index < formData.videos.length - 1 ? '24px' : '0',
                  padding: '20px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#333' }}>Video {index + 1}</h4>
                    {formData.videos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Video Source Radio */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Video Source <span style={{ color: 'red' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: video.video_source === 'youtube' ? '2px solid #1FA8DC' : '1px solid #ddd', backgroundColor: video.video_source === 'youtube' ? '#f0f8ff' : 'white' }}>
                        <input
                          type="radio"
                          name={`video_${index}_source`}
                          value="youtube"
                          checked={video.video_source === 'youtube'}
                          onChange={(e) => handleVideoSourceChange(index, e.target.value)}
                          style={{ marginRight: '8px', cursor: 'pointer' }}
                        />
                        <span>YouTube URL</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: video.video_source === 'vdocipher' ? '2px solid #1FA8DC' : '1px solid #ddd', backgroundColor: video.video_source === 'vdocipher' ? '#f0f8ff' : 'white' }}>
                        <input
                          type="radio"
                          name={`video_${index}_source`}
                          value="vdocipher"
                          checked={video.video_source === 'vdocipher'}
                          onChange={(e) => handleVideoSourceChange(index, e.target.value)}
                          style={{ marginRight: '8px', cursor: 'pointer' }}
                        />
                        <span>VdoCipher</span>
                      </label>
                    </div>
                  </div>

                  {/* YouTube URL Input */}
                  {video.video_source === 'youtube' && (
                    <div style={{ marginBottom: '0' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                        YouTube URL <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={video.youtube_url}
                        onChange={(e) => handleYouTubeUrlChange(index, e.target.value)}
                        placeholder="Enter YouTube Video URL"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: errors[`video_${index}_youtube_url`] ? '2px solid #dc3545' : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      {errors[`video_${index}_youtube_url`] && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors[`video_${index}_youtube_url`]}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VdoCipher Options */}
                  {video.video_source === 'vdocipher' && (
                    <>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                          VdoCipher Option <span style={{ color: 'red' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: video.vdocipher_option === 'video_id' ? '2px solid #1FA8DC' : '1px solid #ddd', backgroundColor: video.vdocipher_option === 'video_id' ? '#f0f8ff' : 'white' }}>
                            <input
                              type="radio"
                              name={`video_${index}_vdocipher_option`}
                              value="video_id"
                              checked={video.vdocipher_option === 'video_id'}
                              onChange={(e) => handleVdoCipherOptionChange(index, e.target.value)}
                              style={{ marginRight: '8px', cursor: 'pointer' }}
                            />
                            <span>Video ID</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: video.vdocipher_option === 'upload' ? '2px solid #1FA8DC' : '1px solid #ddd', backgroundColor: video.vdocipher_option === 'upload' ? '#f0f8ff' : 'white' }}>
                            <input
                              type="radio"
                              name={`video_${index}_vdocipher_option`}
                              value="upload"
                              checked={video.vdocipher_option === 'upload'}
                              onChange={(e) => handleVdoCipherOptionChange(index, e.target.value)}
                              style={{ marginRight: '8px', cursor: 'pointer' }}
                            />
                            <span>Upload</span>
                          </label>
                        </div>
                      </div>

                      {video.vdocipher_option === 'video_id' && (
                        <div style={{ marginBottom: '0' }}>
                          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                            VdoCipher Video ID <span style={{ color: 'red' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={video.vdocipher_video_id}
                            onChange={(e) => handleVdoCipherVideoIdChange(index, e.target.value)}
                            placeholder="Enter VdoCipher Video ID"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: errors[`video_${index}_vdocipher_video_id`] ? '2px solid #dc3545' : '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: '1rem',
                              boxSizing: 'border-box'
                            }}
                          />
                          {errors[`video_${index}_vdocipher_video_id`] && (
                            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                              {errors[`video_${index}_vdocipher_video_id`]}
                            </div>
                          )}
                        </div>
                      )}

                      {video.vdocipher_option === 'upload' && (
                        <div style={{ marginBottom: '0' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                            Upload Video <span style={{ color: 'red' }}>*</span>
                          </label>
                          <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '8px' }}>
                            Max size: 500 MB
                          </div>
                          {video.vdocipher_file || videoPreviews[index] ? (
                            <div
                              className="video-upload-container"
                              style={{
                                position: 'relative',
                                width: '100%',
                                transition: 'all 0.3s ease'
                              }}
                            >
                              <video
                                src={videoPreviews[index] || ''}
                                controls
                                style={{
                                  width: '100%',
                                  maxHeight: '400px',
                                  borderRadius: '12px',
                                  backgroundColor: '#000'
                                }}
                              />
                              {/* Trash icon overlay - shown on hover */}
                              <div
                                className="video-upload-trash"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveVideo(index);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: 72,
                                  height: 72,
                                  borderRadius: '50%',
                                  background: '#dc3545',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0,
                                  transition: 'opacity 0.3s ease',
                                  zIndex: 100,
                                  cursor: 'pointer',
                                  pointerEvents: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.pointerEvents = 'auto';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '0';
                                  e.currentTarget.style.pointerEvents = 'none';
                                }}
                                title="Click to remove video"
                              >
                                <svg
                                  width="32"
                                  height="32"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </div>
                              {/* Uploading spinner overlay */}
                              {uploadingVideos[index] !== undefined && uploadingVideos[index] < 100 && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 20
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      border: '4px solid rgba(255, 255, 255, 0.3)',
                                      borderTop: '4px solid white',
                                      borderRadius: '50%',
                                      animation: 'spin 1s linear infinite'
                                    }}
                                  />
                                </div>
                              )}
                              {video.vdocipher_file && (
                                <div style={{ marginTop: '8px' }}>
                                  <div style={{ fontSize: '0.875rem', color: '#28a745', textAlign: 'center', marginBottom: '8px' }}>
                                    ✅ {video.vdocipher_file.name} ({(video.vdocipher_file.size / (1024 * 1024)).toFixed(2)} MB)
                                  </div>
                                  {/* Progress bar - show while uploading */}
                                  {uploadingVideos[index] !== undefined && (
                                    <div style={{ marginTop: '8px' }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        marginBottom: '4px',
                                        fontSize: '0.75rem',
                                        color: '#6c757d'
                                      }}>
                                        <span>Uploading...</span>
                                        <span>{Math.round(uploadingVideos[index])}%</span>
                                      </div>
                                      <div style={{
                                        width: '100%',
                                        height: '8px',
                                        backgroundColor: '#e9ecef',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          width: `${uploadingVideos[index]}%`,
                                          height: '100%',
                                          backgroundColor: uploadingVideos[index] === 100 ? '#28a745' : '#1FA8DC',
                                          transition: 'width 0.3s ease, background-color 0.3s ease',
                                          borderRadius: '4px'
                                        }} />
                                      </div>
                                    </div>
                                  )}
                                  {/* Permanent success message - show after upload completes */}
                                  {uploadedVideos[index] && (
                                    <div style={{ 
                                      fontSize: '0.875rem', 
                                      color: '#28a745', 
                                      textAlign: 'center', 
                                      marginTop: '8px',
                                      fontWeight: '500'
                                    }}>
                                      ✅ Video uploaded successfully!
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, index)}
                              style={{
                                border: `2px dashed ${dragOverIndex === index ? '#1FA8DC' : '#e9ecef'}`,
                                borderRadius: '12px',
                                padding: '40px 20px',
                                textAlign: 'center',
                                backgroundColor: dragOverIndex === index ? '#f0f8ff' : 'white',
                                transition: 'all 0.3s ease',
                                cursor: (uploadingVideos[index] !== undefined) ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <div style={{ marginBottom: '16px' }}>
                                <svg
                                  width="48"
                                  height="48"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#1FA8DC"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ margin: '0 auto', display: 'block' }}
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="17 8 12 3 7 8"></polyline>
                                  <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                              </div>
                              <p style={{ 
                                margin: '0 0 12px 0', 
                                fontSize: '1rem', 
                                fontWeight: '500',
                                color: '#333'
                              }}>
                                Drag your video file here
                              </p>
                              <p style={{ 
                                margin: '0 0 16px 0', 
                                fontSize: '0.875rem', 
                                color: '#6c757d'
                              }}>
                                or
                              </p>
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVdoCipherFileChange(index, file);
                                }}
                                style={{ display: 'none' }}
                                id={`video-upload-edit-${index}`}
                                disabled={uploadingVideos[index] !== undefined}
                              />
                              <label
                                htmlFor={`video-upload-edit-${index}`}
                                style={{
                                  display: 'inline-block',
                                  padding: '12px 24px',
                                  backgroundColor: (uploadingVideos[index] !== undefined) ? '#6c757d' : '#1FA8DC',
                                  color: 'white',
                                  borderRadius: '8px',
                                  cursor: (uploadingVideos[index] !== undefined) ? 'not-allowed' : 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  opacity: (uploadingVideos[index] !== undefined) ? 0.7 : 1,
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (uploadingVideos[index] === undefined) {
                                    e.target.style.backgroundColor = '#0d5a7a';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (uploadingVideos[index] === undefined) {
                                    e.target.style.backgroundColor = '#1FA8DC';
                                  }
                                }}
                              >
                                {(uploadingVideos[index] !== undefined) ? 'Uploading...' : 'Browse'}
                              </label>
                              {/* Progress bar for drag and drop area - show while uploading */}
                              {uploadingVideos[index] !== undefined && (
                                <div style={{ marginTop: '16px' }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    marginBottom: '4px',
                                    fontSize: '0.75rem',
                                    color: '#6c757d'
                                  }}>
                                    <span>Uploading...</span>
                                    <span>{Math.round(uploadingVideos[index])}%</span>
                                  </div>
                                  <div style={{
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: '#e9ecef',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${uploadingVideos[index]}%`,
                                      height: '100%',
                                      backgroundColor: uploadingVideos[index] === 100 ? '#28a745' : '#1FA8DC',
                                      transition: 'width 0.3s ease, background-color 0.3s ease',
                                      borderRadius: '4px'
                                    }} />
                                  </div>
                                </div>
                              )}
                              {/* Permanent success message - show after upload completes */}
                              {uploadedVideos[index] && (
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  color: '#28a745', 
                                  textAlign: 'center', 
                                  marginTop: '16px',
                                  fontWeight: '500'
                                }}>
                                  ✅ Video uploaded successfully!
                                </div>
                              )}
                            </div>
                          )}
                          {errors[`video_${index}_vdocipher_file`] && (
                            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '8px' }}>
                              {errors[`video_${index}_vdocipher_file`]}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addVideo}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>+</span> Add Another Video
              </button>

              {errors.videos && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '8px' }}>
                  {errors.videos}
                </div>
              )}
            </div>

            {/* Description Textarea */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter Description if you want..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* General Error */}
            {errors.general && (
              <div style={{
                color: '#dc3545',
                fontSize: '0.875rem',
                marginBottom: '16px',
                padding: '8px 12px',
                backgroundColor: '#f8d7da',
                borderRadius: '6px',
                border: '1px solid #f5c6cb',
                textAlign: 'center'
              }}>
                {errors.general}
              </div>
            )}

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={updateSessionMutation.isPending || Object.values(uploadingVideos).some(v => v !== undefined && v < 100)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (updateSessionMutation.isPending || Object.values(uploadingVideos).some(v => v !== undefined && v < 100)) ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: (updateSessionMutation.isPending || Object.values(uploadingVideos).some(v => v !== undefined && v < 100)) ? 'not-allowed' : 'pointer',
                  opacity: (updateSessionMutation.isPending || Object.values(uploadingVideos).some(v => v !== undefined && v < 100)) ? 0.6 : 1
                }}
              >
                {updateSessionMutation.isPending ? 'Updating...' : Object.values(uploadingVideos).some(v => v !== undefined && v < 100) ? 'Uploading...' : 'Update Session'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/manage_online_system/online_sessions')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .video-upload-container:hover video {
            filter: blur(4px);
          }
          .video-upload-container:hover .video-upload-trash {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
              padding: 10px 5px 10px 5px !important;
              max-width: 100% !important;
            }
            
            .form-container {
              padding: 16px !important;
              margin-top: 16px !important;
            }
            
            .form-container input[type="text"],
            .form-container input[type="url"],
            .form-container textarea {
              font-size: 16px !important; /* Prevents zoom on iOS */
            }
            
            .form-container button {
              width: 100% !important;
              margin-bottom: 8px !important;
            }
            
            .form-container > form > div:last-child {
              flex-direction: column !important;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 5px !important;
            }
            
            .page-content {
              margin: 10px auto !important;
              padding: 5px !important;
            }
            
            .form-container {
              padding: 12px !important;
              border-radius: 12px !important;
            }
            
            .form-container label {
              font-size: 0.9rem !important;
            }
            
            .form-container input,
            .form-container textarea {
              font-size: 16px !important;
              padding: 8px 10px !important;
            }
          }
          
          @media (max-width: 360px) {
            .form-container {
              padding: 10px !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

