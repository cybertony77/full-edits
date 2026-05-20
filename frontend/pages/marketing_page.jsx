import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Playfair_Display, Caveat, Lora } from 'next/font/google';
import {
  Avatar,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { IconCheck, IconX } from '@tabler/icons-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import TitleBar from '../components/Title';
import CourseSelect from '../components/CourseSelect';
import MarketingPageLoader from '../components/MarketingPageLoader';
import MarketingMultiSelect from '../components/MarketingMultiSelect';
import { useProfile } from '../lib/api/auth';
import { useSystemConfig } from '../lib/api/system';
import apiClient from '../lib/axios';
import {
  buildCenterScheduleRows,
  formatTeached,
  formatYears,
  isWhatsAppLinkName,
  socialIconSrc,
  toYoutubeEmbed,
} from '../lib/marketingPageClientUtils';
import mp from '../styles/marketing_page.module.css';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600'] });
const caveat = Caveat({ subsets: ['latin'], weight: ['400', '600', '700'] });
const lora = Lora({ subsets: ['latin'], weight: ['400', '500', '600'] });

function ScheduleLocationCell({ row }) {
  const centerName = (row.center || '').trim();
  if (centerName.toLowerCase() === 'online') {
    return <span className={mp.scheduleLocationMuted}>Online</span>;
  }
  const loc = row.location && String(row.location).trim();
  if (loc) {
    return (
      <button
        type="button"
        className={mp.scheduleLocationLink}
        onClick={() => window.open(loc, '_blank', 'noopener,noreferrer')}
      >
        <Image src="/maps.svg" alt="" width={20} height={20} />
        Location
      </button>
    );
  }
  return <span className={mp.scheduleLocationMuted}>No Location</span>;
}

const HERO_SECTION_STYLE = {
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  background:
    'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)), url(https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&q=70) center/cover',
};

const PAGE_STATE_CARD = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
  border: '1px solid rgba(31, 168, 220, 0.22)',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
  color: '#1e293b',
};

const MAX_TEACHER_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TEACHER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function resolveTeacherImageMime(file) {
  const type = (file?.type || '').toLowerCase();
  if (ALLOWED_TEACHER_IMAGE_TYPES.has(type)) {
    return type === 'image/jpg' ? 'image/jpeg' : type;
  }
  const ext = (file?.name || '').split('.').pop()?.toLowerCase();
  const byExt = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return byExt[ext] || null;
}

function readFileAsDataUrl(blobOrFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(blobOrFile);
  });
}

async function prepareTeacherImageForUpload(file) {
  const mime = resolveTeacherImageMime(file);
  if (!mime) return null;

  if (file.size > MAX_TEACHER_IMAGE_BYTES) {
    throw new Error('MAX_SIZE');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Invalid image file'));
      el.src = objectUrl;
    });

    const maxDim = 1600;
    let { naturalWidth: width, naturalHeight: height } = img;
    const shouldResize = file.size > 900 * 1024 || width > maxDim || height > maxDim;

    if (!shouldResize) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, fileType: mime };
    }

    const scale = Math.min(1, maxDim / width, maxDim / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(img, 0, 0, width, height);

    const outMime = mime === 'image/png' || mime === 'image/gif' ? mime : 'image/jpeg';
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not process image'))),
        outMime,
        outMime === 'image/jpeg' ? 0.88 : undefined
      );
    });

    if (blob.size > MAX_TEACHER_IMAGE_BYTES) {
      throw new Error('MAX_SIZE');
    }

    const dataUrl = await readFileAsDataUrl(blob);
    return { dataUrl, fileType: outMime };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildBaselineSnapshot(json) {
  const L = json.links?.length ? json.links : [{ name: '', link: '', phone: '' }];
  const links = L.map((row) => {
    const wa = (row.link || '').match(/^https?:\/\/wa\.me\/(\d+)/i);
    return { name: row.name || '', link: row.link || '', phone: wa ? wa[1] : '' };
  });
  const T = json.students_testimonials?.length
    ? json.students_testimonials
    : [{ name: '', course: '', text: '', score: '' }];
  const testimonials = T.map((t) => ({
    name: t.name || '',
    course: t.course || '',
    text: t.text || '',
    score: t.score || '',
  }));
  return JSON.stringify({
    page_state: json.page_state !== false,
    teacher_picture: json.teacher_picture ?? null,
    teacher_name: json.teacher_name || '',
    teacher_description: json.teacher_description || '',
    students_teached:
      json.students_teached === null || json.students_teached === undefined
        ? ''
        : String(json.students_teached),
    years_of_experience:
      json.years_of_experience === null || json.years_of_experience === undefined
        ? ''
        : String(json.years_of_experience),
    yt_session_link: json.yt_session_link || '',
    centerIds: [...(json.dates_of_session_ids || [])].sort(),
    assistantIds: [...(json.contact_assistant_ids || [])].sort(),
    links,
    testimonials,
    outro_text: json.outro_text || '',
    note: json.note || '',
  });
}

function useInViewOnce(ref, onVisible) {
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !done.current) {
          done.current = true;
          onVisible();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, onVisible]);
}

function AnimatedInteger({ value, formatter }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  useInViewOnce(ref, () => setStarted(true));

  useEffect(() => {
    if (!started || value === null || value === undefined || Number.isNaN(Number(value))) return;
    const target = Number(value);
    const dur = 1400;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 3;
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, value]);

  const v = formatter ? formatter(n) : String(n);
  return <span ref={ref}>{v}</span>;
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
}

function isValidHttpUrl(value) {
  const v = String(value || '').trim();
  return /^https?:\/\/\S+$/i.test(v);
}

export default function MarketingPage() {
  const router = useRouter();
  const { data: systemConfig } = useSystemConfig();
  const { data: user } = useProfile();
  const headerTitle = systemConfig?.name || 'Public Page';

  const handleMarketingLogoClick = useCallback(() => {
    const role = user?.role || '';
    if (role === 'student') {
      router.push('/student_dashboard');
    } else if (role) {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  }, [user?.role, router]);

  const [loading, setLoading] = useState(true);
  const [hidePageLoader, setHidePageLoader] = useState(false);
  const [confirmHideOpen, setConfirmHideOpen] = useState(false);
  const [formBaseline, setFormBaseline] = useState('');
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ centers: [], centersDetail: [], staff: [] });
  const [embla, setEmbla] = useState(null);

  const [pageStateChecked, setPageStateChecked] = useState(true);
  const [teacherPicture, setTeacherPicture] = useState(null);
  const [teacherPictureUrl, setTeacherPictureUrl] = useState(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherDescription, setTeacherDescription] = useState('');
  const [outroText, setOutroText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [copyLinkSuccess, setCopyLinkSuccess] = useState('');
  const [testimonialCourseOpen, setTestimonialCourseOpen] = useState({});
  const [studentsTeached, setStudentsTeached] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [ytLink, setYtLink] = useState('');
  const [centerIds, setCenterIds] = useState([]);
  const [assistantIds, setAssistantIds] = useState([]);
  const [links, setLinks] = useState([{ name: '', link: '', phone: '' }]);
  const [testimonials, setTestimonials] = useState([
    { name: '', course: '', text: '', score: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [teacherPicError, setTeacherPicError] = useState('');
  const [linksError, setLinksError] = useState('');

  const lastServerHashRef = useRef('');
  const hasFormChangesRef = useRef(false);

  const applyFormFromServer = useCallback((json) => {
    setPageStateChecked(json.page_state !== false);
    setTeacherPicture(json.teacher_picture);
    setTeacherPictureUrl(json.teacher_picture_url);
    setImagePreview(json.teacher_picture_url || null);
    setTeacherName(json.teacher_name || '');
    setTeacherDescription(json.teacher_description || '');
    setOutroText(json.outro_text || '');
    setNoteText(json.note || '');
    setStudentsTeached(
      json.students_teached === null || json.students_teached === undefined
        ? ''
        : String(json.students_teached)
    );
    setYearsExperience(
      json.years_of_experience === null || json.years_of_experience === undefined
        ? ''
        : String(json.years_of_experience)
    );
    setYtLink(json.yt_session_link || '');
    setCenterIds(json.dates_of_session_ids || []);
    setAssistantIds(json.contact_assistant_ids || []);
    const L = json.links?.length ? json.links : [{ name: '', link: '', phone: '' }];
    setLinks(
      L.map((row) => {
        const wa = (row.link || '').match(/^https?:\/\/wa\.me\/(\d+)/i);
        return {
          name: row.name || '',
          link: row.link || '',
          phone: wa ? wa[1] : '',
        };
      })
    );
    const T = json.students_testimonials?.length
      ? json.students_testimonials
      : [{ name: '', course: '', text: '', score: '' }];
    setTestimonials(
      T.map((t) => ({
        name: t.name || '',
        course: t.course || '',
        text: t.text || '',
        score: t.score || '',
      }))
    );
    setFormBaseline(buildBaselineSnapshot(json));
  }, []);

  const fetchMarketingPage = useCallback(
    async ({ silent = false, forceFormSync = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch('/api/marketing_page', { credentials: 'include' });
        if (res.status === 404) {
          router.replace(`/404?path=${encodeURIComponent('/marketing_page')}`);
          return;
        }
        const json = await res.json();
        const hash = buildBaselineSnapshot(json);
        const changed = hash !== lastServerHashRef.current;

        if (silent && !changed) return;

        lastServerHashRef.current = hash;
        setData(json);

        const shouldSyncForm =
          forceFormSync || (json.canEdit && !hasFormChangesRef.current);

        if (json.canEdit) {
          if (shouldSyncForm) {
            applyFormFromServer(json);
          }
          if (!silent || forceFormSync) {
            try {
              const o = await apiClient.get('/api/marketing_page/options');
              setOptions(o.data);
            } catch {
              setOptions({ centers: [], centersDetail: [], staff: [] });
            }
          }
        } else if (shouldSyncForm) {
          applyFormFromServer(json);
        }
      } catch {
        if (!silent) {
          router.replace(`/404?path=${encodeURIComponent('/marketing_page')}`);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [router, applyFormFromServer]
  );

  useEffect(() => {
    fetchMarketingPage({ forceFormSync: true });
  }, [fetchMarketingPage]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketingPage({ silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketingPage]);

  useEffect(() => {
    if (!teacherPicError) return;
    const t = setTimeout(() => setTeacherPicError(''), 6000);
    return () => clearTimeout(t);
  }, [teacherPicError]);

  const canEdit = data?.canEdit;
  const isAssistant = user?.role === 'assistant';

  const teacherPreviewBeforeUploadRef = useRef(null);

  const processTeacherImage = async (file) => {
    if (!file || !canEdit) return;
    setTeacherPicError('');
    teacherPreviewBeforeUploadRef.current = imagePreview;

    let prepared;
    try {
      prepared = await prepareTeacherImageForUpload(file);
      if (!prepared) {
        setTeacherPicError('Please select a JPEG, PNG, GIF, or WEBP image.');
        return;
      }
    } catch (prepErr) {
      if (prepErr?.message === 'MAX_SIZE') {
        setTeacherPicError('Max size is 10 MB. Try a smaller image.');
        return;
      }
      setTeacherPicError(prepErr?.message || 'Invalid image file. Please try another picture.');
      return;
    }

    setImagePreview(prepared.dataUrl);
    setUploadingPic(true);
    try {
      const response = await apiClient.post('/api/upload/profile-picture', {
        file: prepared.dataUrl,
        fileName: file.name,
        fileType: prepared.fileType,
        folder: 'unlisted',
      });
      if (response.data?.success && response.data?.public_id) {
        const pid = response.data.public_id;
        await apiClient.patch('/api/marketing_page', { teacher_picture: pid });
        setTeacherPicture(pid);
        const res = await fetch('/api/marketing_page', { credentials: 'include' });
        if (res.ok) {
          const j = await res.json();
          setTeacherPictureUrl(j.teacher_picture_url);
          setImagePreview(j.teacher_picture_url || null);
          setData((d) =>
            d ? { ...d, teacher_picture_url: j.teacher_picture_url, teacher_picture: pid } : d
          );
        }
      }
    } catch (err) {
      setTeacherPicError(err.response?.data?.error || 'Failed to upload image. Please try again.');
      setImagePreview(teacherPreviewBeforeUploadRef.current);
    } finally {
      setUploadingPic(false);
    }
  };

  const handleTeacherDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploadingPic && canEdit) setIsDragging(true);
  };

  const handleTeacherDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleTeacherDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploadingPic || !canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processTeacherImage(file);
  };

  const handleTeacherFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await processTeacherImage(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (!embla || canEdit || !(data?.students_testimonials || []).filter((t) => t.name && t.course && t.text).length) {
      return;
    }
    const id = setInterval(() => {
      if (embla.canScrollNext()) embla.scrollNext();
      else embla.scrollTo(0);
    }, 5000);
    return () => clearInterval(id);
  }, [embla, data?.students_testimonials, canEdit]);

  const patch = async (body) => {
    setSaving(true);
    try {
      await apiClient.patch('/api/marketing_page', body);
      await fetchMarketingPage({ silent: true, forceFormSync: true });
    } finally {
      setSaving(false);
    }
  };

  const currentFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        page_state: pageStateChecked,
        teacher_picture: teacherPicture,
        teacher_name: teacherName,
        teacher_description: teacherDescription,
        students_teached: studentsTeached,
        years_of_experience: yearsExperience,
        yt_session_link: ytLink,
        centerIds: [...centerIds].sort(),
        assistantIds: [...assistantIds].sort(),
        links,
        testimonials,
        outro_text: outroText,
        note: noteText,
      }),
    [
      pageStateChecked,
      teacherPicture,
      teacherName,
      teacherDescription,
      studentsTeached,
      yearsExperience,
      ytLink,
      centerIds,
      assistantIds,
      links,
      testimonials,
      outroText,
      noteText,
    ]
  );

  const hasFormChanges = canEdit && formBaseline && currentFormSnapshot !== formBaseline;

  useEffect(() => {
    hasFormChangesRef.current = !!hasFormChanges;
  }, [hasFormChanges]);

  const publishPage = async () => {
    setPageStateChecked(true);
    try {
      await apiClient.patch('/api/marketing_page', { page_state: true });
      await fetchMarketingPage({ silent: true, forceFormSync: true });
    } catch {
      setPageStateChecked(false);
    }
  };

  const confirmHidePage = async () => {
    setConfirmHideOpen(false);
    setHidePageLoader(true);
    setPageStateChecked(false);
    try {
      await apiClient.patch('/api/marketing_page', { page_state: false });
      await fetchMarketingPage({ silent: true, forceFormSync: true });
    } catch {
      setPageStateChecked(true);
    } finally {
      window.setTimeout(() => setHidePageLoader(false), 4000);
    }
  };

  const handlePageStateToggle = (nextChecked) => {
    if (nextChecked) {
      publishPage();
      return;
    }
    if (pageStateChecked) {
      setConfirmHideOpen(true);
    }
  };

  const saveContent = async () => {
    const invalidLinkRow = links.find((row) => {
      const name = (row.name || '').trim();
      if (!name) return false;
      if (isWhatsAppLinkName(name)) return false;
      const link = (row.link || '').trim();
      return link && !isValidHttpUrl(link);
    });

    if (invalidLinkRow) {
      setLinksError('All URLs must start with http:// or https://');
      return;
    }

    setLinksError('');

    const linksPayload = links
      .map((row) => {
        const name = row.name.trim();
        if (!name) return null;
        const isWa = isWhatsAppLinkName(name);
        let link = (row.link || '').trim();
        if (isWa) {
          const digits = formatPhoneForWhatsApp(row.phone || link);
          if (!digits) return null;
          link = `https://wa.me/${digits}`;
        }
        if (!link) return null;
        return { name, link };
      })
      .filter(Boolean);

    const testimonialsPayload = testimonials
      .map((t) => ({
        name: t.name.trim(),
        course: t.course.trim(),
        text: t.text.trim(),
        score: t.score?.trim() ? t.score.trim() : null,
      }))
      .filter((t) => t.name && t.course && t.text);

    await patch({
      teacher_picture: teacherPicture,
      teacher_name: teacherName.trim() || null,
      teacher_description: teacherDescription.trim() || null,
      students_teached: studentsTeached === '' ? null : Number(studentsTeached),
      years_of_experience: yearsExperience === '' ? null : Number(yearsExperience),
      yt_session_link: ytLink.trim() || null,
      dates_of_sessions: centerIds,
      contact_assistants: assistantIds,
      links: linksPayload.length ? linksPayload : null,
      students_testimonials: testimonialsPayload.length ? testimonialsPayload : null,
      outro_text: outroText.trim() || null,
      note: noteText.trim() || null,
    });
  };

  const marketingPageUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/marketing_page`;
  }, []);

  const copyMarketingPageLink = () => {
    const url = marketingPageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    navigator.clipboard.writeText(url);
    setCopyLinkSuccess('Link copied to clipboard');
    window.setTimeout(() => setCopyLinkSuccess(''), 3000);
  };

  const previewScheduleRows = useMemo(() => {
    if (!canEdit) return data?.schedule_rows || [];
    const detail = options.centersDetail || [];
    if (!centerIds.length || !detail.length) return [];
    const idSet = new Set(centerIds);
    const selected = detail.filter((c) => idSet.has(c._id));
    return buildCenterScheduleRows(selected);
  }, [canEdit, data?.schedule_rows, centerIds, options.centersDetail]);

  const previewAssistants = useMemo(() => {
    if (!canEdit) return data?.assistants || [];
    if (!assistantIds.length) return [];
    const staffMap = new Map((options.staff || []).map((s) => [s.value, s]));
    return assistantIds
      .map((id) => {
        const s = staffMap.get(id);
        if (!s) return null;
        return {
          _id: id,
          name: s.name || s.label,
          phone: s.phone || '',
          role: s.role || '',
        };
      })
      .filter(Boolean);
  }, [canEdit, data?.assistants, assistantIds, options.staff]);

  const scheduleRows = canEdit ? previewScheduleRows : data?.schedule_rows || [];
  const contactAssistants = canEdit ? previewAssistants : data?.assistants || [];

  const embedUrl = useMemo(() => toYoutubeEmbed(canEdit ? ytLink : data?.yt_session_link), [
    canEdit,
    ytLink,
    data?.yt_session_link,
  ]);

  if (loading || !data) {
    return <MarketingPageLoader label="Loading page" sub="Preparing marketing content…" />;
  }

  if (hidePageLoader) {
    return <MarketingPageLoader label="Updating page" sub="Hiding marketing page…" />;
  }

  const viewTestimonials = (data.students_testimonials || []).filter(
    (t) => t.name && t.course && t.text
  );
  const viewLinks = (data.links || []).filter((l) => l.name && l.link);
  const hasHeroVisual =
    data.teacher_picture_url ||
    (data.teacher_name && data.teacher_name.trim()) ||
    (data.teacher_description && data.teacher_description.trim()) ||
    data.students_teached != null ||
    data.years_of_experience != null;

  return (
    <Box
      className={mp.marketingPageRoot}
      style={{
        minHeight: '100vh',
        color: '#e7ecf3',
        paddingBottom: 48,
      }}
    >
      {!canEdit && !isAssistant && (
        <Box component="header" className={mp.publicHeader} py="sm" px="md">
          <Group
            className={mp.publicHeaderInner}
            justify="space-between"
            align="center"
            wrap="nowrap"
            gap="sm"
            maw={1100}
            mx="auto"
          >
            <div className={mp.publicHeaderBrand}>
              <button
                type="button"
                className={mp.publicHeaderLogoBtn}
                onClick={handleMarketingLogoClick}
                aria-label={`Go to ${headerTitle} home`}
              >
                <Image
                  src="/logo.png"
                  alt={`${headerTitle} logo`}
                  width={50}
                  height={50}
                  className={mp.publicHeaderLogo}
                />
              </button>
              <span className={mp.publicHeaderTitle}>{headerTitle}</span>
            </div>
            <Button
              className={mp.publicHeaderCopyBtn}
              variant="light"
              color="gray"
              leftSection={<Image src="/copy2.svg" alt="" width={18} height={18} />}
              onClick={copyMarketingPageLink}
            >
              Copy page URL
            </Button>
          </Group>
        </Box>
      )}

      <Stack gap="xl" maw={1100} mx="auto" px="md" mt="lg" className={mp.sectionsStack}>
        {!canEdit && isAssistant && (
          <Box className={mp.editPageWrap}>
            <TitleBar
              backText="Back"
              href="/dashboard"
              className={mp.titleBar}
              style={{ flexWrap: 'wrap', gap: 12 }}
            >
              <div className={mp.titleHeading}>
                <Image src="/marketing.svg" alt="" width={32} height={32} />
                <span className={mp.titleText}>Marketing Page</span>
              </div>
            </TitleBar>
          </Box>
        )}
        {canEdit && (
          <Box className={mp.editPageWrap}>
            <TitleBar
              backText="Back"
              href={null}
              className={mp.titleBar}
              style={{ flexWrap: 'wrap', gap: 12 }}
            >
              <div className={mp.titleHeading}>
                <Image src="/marketing.svg" alt="" width={32} height={32} />
                <span className={mp.titleText}>Manage Marketing Page</span>
              </div>
            </TitleBar>

            <Paper
              shadow="none"
              radius="lg"
              p="lg"
              className={mp.pageStateCard}
              styles={{ root: { boxShadow: 'none' } }}
            >
              <div className={mp.pageStateInner}>
                <div className={mp.pageStateText}>
                  <Text fw={800} size="lg" className={mp.pageStateTitle}>
                    Page State
                  </Text>
                  <Text size="sm" className={mp.pageStateDesc} mt={4}>
                    {pageStateChecked
                      ? 'Visitors can view the page.'
                      : 'Page is hidden from visitors.'}
                  </Text>
                </div>
                <div className={mp.pageStateSwitchWrap}>
                  <Switch
                    className={mp.pageStateSwitch}
                    checked={pageStateChecked}
                    onChange={(e) => handlePageStateToggle(e.currentTarget.checked)}
                    color="teal"
                    size="lg"
                    disabled={saving}
                    label={pageStateChecked ? 'Published' : 'Hidden'}
                    styles={{ label: { color: '#e2e8f0', fontWeight: 700 } }}
                    thumbIcon={
                      pageStateChecked ? (
                        <IconCheck size={12} color="var(--mantine-color-teal-6)" />
                      ) : (
                        <IconX size={12} color="var(--mantine-color-red-6)" />
                      )
                    }
                  />
                </div>
              </div>
            </Paper>
          </Box>
        )}

        {/* Section 1 — Hero */}
        {(hasHeroVisual || viewTestimonials.length > 0 || canEdit) && (
          <Paper radius="xl" p={{ base: 'md', sm: 'xl' }} style={HERO_SECTION_STYLE}>
            <Stack gap="lg">
              <Group align="flex-start" justify="center" wrap="wrap" gap="xl">
                {(data.teacher_picture_url || canEdit || imagePreview) && (
                  <Box style={{ flexShrink: 0, textAlign: 'center' }}>
                    {!canEdit && data.teacher_picture_url ? (
                      <Stack gap="sm" align="center">
                        <Box
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            margin: '0 auto',
                            overflow: 'hidden',
                            border: '2px solid #1FA8DC',
                            boxShadow: '0 2px 8px rgba(31,168,220,0.15)',
                            position: 'relative',
                          }}
                        >
                          <Image
                            src={data.teacher_picture_url}
                            alt="Teacher"
                            fill
                            style={{ objectFit: 'cover' }}
                            unoptimized
                          />
                        </Box>
                        {data.teacher_name?.trim() ? (
                          <Title
                            order={2}
                            ta="center"
                            c="orange.4"
                            style={{ fontSize: 'clamp(1.25rem, 4vw, 1.65rem)' }}
                          >
                            {data.teacher_name}
                          </Title>
                        ) : null}
                      </Stack>
                    ) : canEdit ? (
                      <Box>
                        <Text
                          size="sm"
                          fw={600}
                          c="gray.2"
                          mb={10}
                          style={{ display: 'block', textAlign: 'center' }}
                        >
                          Profile Picture
                        </Text>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          {imagePreview ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <div
                                onDragOver={handleTeacherDragOver}
                                onDragLeave={handleTeacherDragLeave}
                                onDrop={handleTeacherDrop}
                                style={{
                                  width: 120,
                                  height: 120,
                                  borderRadius: '50%',
                                  background: '#e9ecef',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: isDragging
                                    ? '0 4px 16px rgba(31,168,220,0.4)'
                                    : '0 2px 8px rgba(31,168,220,0.15)',
                                  border: isDragging ? '3px dashed #1FA8DC' : '2px solid #1FA8DC',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                                  transition: 'all 0.3s ease',
                                }}
                                title="Drag & drop new image"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from FileReader (same as sign-up) */}
                                <img
                                  src={imagePreview}
                                  alt="Profile preview"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    borderRadius: '50%',
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  setImagePreview(null);
                                  await apiClient.patch('/api/marketing_page', { teacher_picture: null });
                                  setTeacherPicture(null);
                                  setTeacherPictureUrl(null);
                                  setData((d) =>
                                    d ? { ...d, teacher_picture_url: null, teacher_picture: null } : d
                                  );
                                  const el = document.getElementById('marketing-teacher-picture-upload');
                                  if (el) el.value = '';
                                }}
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: '#dc3545',
                                  border: '2px solid white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                  transition: 'all 0.2s ease',
                                  zIndex: 9,
                                }}
                                title="Remove image"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor="marketing-teacher-picture-upload"
                              onDragOver={handleTeacherDragOver}
                              onDragLeave={handleTeacherDragLeave}
                              onDrop={handleTeacherDrop}
                              style={{
                                width: 120,
                                height: 120,
                                borderRadius: '50%',
                                background: uploadingPic
                                  ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)'
                                  : isDragging
                                    ? 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)'
                                    : 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: uploadingPic ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                textAlign: 'center',
                                transition: 'all 0.3s ease',
                                boxShadow: isDragging
                                  ? '0 6px 20px rgba(31, 168, 220, 0.5)'
                                  : '0 4px 12px rgba(135, 206, 235, 0.3)',
                                opacity: uploadingPic ? 0.7 : 1,
                                border: isDragging ? '3px dashed white' : '2px solid #1FA8DC',
                                flexDirection: 'column',
                                gap: 8,
                                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                              }}
                            >
                              {uploadingPic ? (
                                <>
                                  <div className={mp.teacherUploadSpin} />
                                  <span style={{ fontSize: '0.75rem' }}>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Image
                                    src="/upload.svg"
                                    alt="Upload"
                                    width={32}
                                    height={32}
                                    style={{ filter: 'brightness(0) invert(1)' }}
                                  />
                                  <span style={{ fontSize: '0.75rem' }}>Upload Picture</span>
                                </>
                              )}
                            </label>
                          )}
                          <input
                            id="marketing-teacher-picture-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleTeacherFileInputChange}
                            disabled={uploadingPic}
                            style={{ display: 'none' }}
                          />
                          <small style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                            Max size: 10 MB.
                          </small>
                          {teacherPicError ? (
                            <Text size="sm" c="red.4" mt={4} style={{ maxWidth: 280 }}>
                              {teacherPicError}
                            </Text>
                          ) : null}
                        </div>
                      </Box>
                    ) : null}
                  </Box>
                )}

                <Stack gap="md" style={{ flex: 1, minWidth: 260, maxWidth: 560 }}>
                  {!canEdit && data.teacher_description?.trim() ? (
                    <Text
                      size="lg"
                      ta="center"
                      className={`${mp.descriptionText} ${playfair.className}`}
                    >
                      {data.teacher_description}
                    </Text>
                  ) : null}
                  {canEdit && (
                    <Stack gap="md" className={`${mp.editForm} ${mp.editFormHero}`}>
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                          className="form-input"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                          placeholder="Teacher name"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-input"
                          rows={5}
                          value={teacherDescription}
                          onChange={(e) => setTeacherDescription(e.target.value)}
                          placeholder="Write a short introduction…"
                          style={{ resize: 'vertical', minHeight: 120 }}
                        />
                      </div>
                    </Stack>
                  )}
                </Stack>
              </Group>

              {(data.students_teached != null || data.years_of_experience != null || canEdit) && (
                <Group
                  justify="center"
                  grow
                  gap="xl"
                  wrap="wrap"
                  mt="md"
                  style={{
                    padding: '28px 16px',
                    borderRadius: 16,
                    background: 'rgba(0,0,0,0.35)',
                  }}
                >
                  {(data.students_teached != null || canEdit) && (
                    <Stack gap={6} align="center" style={{ minWidth: 200 }}>
                      {canEdit ? (
                        <NumberInput
                          label="Students taught"
                          value={studentsTeached === '' ? undefined : Number(studentsTeached)}
                          onChange={(v) => setStudentsTeached(v === '' || v === undefined ? '' : String(v))}
                          hideControls
                          styles={{ input: { fontSize: 28, fontWeight: 800, textAlign: 'center' } }}
                        />
                      ) : (
                        <>
                          <Title order={2} c="orange.4" style={{ fontSize: 'clamp(2rem, 6vw, 3rem)' }}>
                            <AnimatedInteger
                              value={data.students_teached}
                              formatter={(n) => formatTeached(n)}
                            />
                          </Title>
                          <Text fw={700} c="gray.1">
                            Students teached
                          </Text>
                        </>
                      )}
                    </Stack>
                  )}
                  {(data.years_of_experience != null || canEdit) && (
                    <Stack gap={6} align="center" style={{ minWidth: 200 }}>
                      {canEdit ? (
                        <NumberInput
                          label="Years of experience"
                          value={yearsExperience === '' ? undefined : Number(yearsExperience)}
                          onChange={(v) => setYearsExperience(v === '' || v === undefined ? '' : String(v))}
                          hideControls
                          styles={{ input: { fontSize: 28, fontWeight: 800, textAlign: 'center' } }}
                        />
                      ) : (
                        <>
                          <Title order={2} c="orange.4" style={{ fontSize: 'clamp(2rem, 6vw, 3rem)' }}>
                            <AnimatedInteger value={data.years_of_experience} formatter={formatYears} />
                          </Title>
                          <Text fw={700} c="gray.1">
                            Years of experience
                          </Text>
                        </>
                      )}
                    </Stack>
                  )}
                </Group>
              )}

              {viewTestimonials.length > 0 && !canEdit && (
                <Carousel
                  className={mp.testimonialCarousel}
                  slideSize="100%"
                  height="auto"
                  emblaOptions={{ loop: true, align: 'start' }}
                  getEmblaApi={setEmbla}
                  withIndicators
                  withControls={false}
                  styles={{
                    indicator: { background: 'rgba(254, 185, 84, 0.35)' },
                    indicators: {
                      position: 'relative',
                      bottom: 'auto',
                      marginTop: 10,
                    },
                  }}
                >
                  {viewTestimonials.map((t, idx) => (
                    <Carousel.Slide key={`${t.name}-${idx}`}>
                      <Paper p="lg" className={mp.testimonialCard}>
                        <Group gap="sm" mb="sm">
                          <Avatar radius="xl" color="orange">
                            {t.name?.[0]}
                          </Avatar>
                          <Text fw={700} className={mp.testimonialName}>
                            {t.name} • {t.course}
                          </Text>
                        </Group>
                        <Text className={mp.testimonialBody}>{t.text}</Text>
                        {t.score ? (
                          <Text mt="sm" size="sm" fw={600} className={mp.testimonialScore}>
                            score : {t.score}
                          </Text>
                        ) : null}
                      </Paper>
                    </Carousel.Slide>
                  ))}
                </Carousel>
              )}

              {canEdit && (
                <Stack gap="sm" className={mp.editForm}>
                  <Text fw={700} c="gray.1">
                    Students testimonials
                  </Text>
                  {testimonials.map((t, i) => (
                    <Paper key={i} p="md" radius="md" className={mp.editItemCard} style={PAGE_STATE_CARD}>
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                          className="form-input"
                          value={t.name}
                          onChange={(e) => {
                            const v = [...testimonials];
                            v[i].name = e.target.value;
                            setTestimonials(v);
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Course</label>
                        <CourseSelect
                          selectedGrade={t.course}
                          onGradeChange={(course) => {
                            const v = [...testimonials];
                            v[i].course = course;
                            setTestimonials(v);
                          }}
                          isOpen={!!testimonialCourseOpen[i]}
                          onToggle={() =>
                            setTestimonialCourseOpen((o) => ({ ...o, [i]: !o[i] }))
                          }
                          onClose={() =>
                            setTestimonialCourseOpen((o) => ({ ...o, [i]: false }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Score (optional)</label>
                        <input
                          className="form-input"
                          value={t.score}
                          onChange={(e) => {
                            const v = [...testimonials];
                            v[i].score = e.target.value;
                            setTestimonials(v);
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Text</label>
                        <textarea
                          className="form-input"
                          rows={3}
                          value={t.text}
                          onChange={(e) => {
                            const v = [...testimonials];
                            v[i].text = e.target.value;
                            setTestimonials(v);
                          }}
                        />
                      </div>
                      <div className={mp.editItemDeleteRow}>
                        <button
                          type="button"
                          className={mp.btnDelete}
                          onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}
                        >
                          Delete
                        </button>
                      </div>
                    </Paper>
                  ))}
                  <button
                    type="button"
                    className={mp.btnAdd}
                    onClick={() =>
                      setTestimonials([...testimonials, { name: '', course: '', text: '', score: '' }])
                    }
                  >
                    <Image src="/plus.svg" alt="" width={18} height={18} />
                    Add testimonial
                  </button>
                </Stack>
              )}
            </Stack>
          </Paper>
        )}

        {/* Section 2 — Links (mobile: after Contact Us) */}
        {(viewLinks.length > 0 || canEdit) && (
          <Paper radius="xl" p="lg" className={`${mp.darkSection} ${mp.section} ${mp.linksSection}`}>
            <Title order={3} mb="md" className={mp.darkSectionTitle}>
              Links
            </Title>
            {canEdit && (
              <Stack gap="sm" mb="md" className={mp.editForm}>
                {linksError ? (
                  <Text size="sm" c="red.4">
                    {linksError}
                  </Text>
                ) : null}
                {links.map((row, i) => {
                  const isWa = isWhatsAppLinkName(row.name);
                  const hasInvalidUrl =
                    !isWa && (row.link || '').trim() && !isValidHttpUrl(row.link || '');
                  return (
                    <Paper key={i} p="md" radius="md" className={mp.editItemCard} style={{ border: '1px solid #e9ecef' }}>
                      <div className="form-group">
                        <label className="form-label">Button text</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Facebook Page"
                          value={row.name}
                          onChange={(e) => {
                            const v = [...links];
                            v[i].name = e.target.value;
                            setLinks(v);
                          }}
                        />
                      </div>
                      {isWa ? (
                        <div className="form-group">
                          <label className="form-label">WhatsApp number</label>
                          <PhoneInput
                            country="eg"
                            value={row.phone || ''}
                            onChange={(phone) => {
                              const v = [...links];
                              v[i].phone = phone;
                              setLinks(v);
                            }}
                            inputStyle={{ width: '100%', height: 48, borderRadius: 10 }}
                          />
                        </div>
                      ) : (
                        <div className="form-group">
                          <label className="form-label">URL</label>
                          <input
                            className="form-input"
                            type="url"
                            placeholder="https://example.com"
                            value={row.link}
                            onChange={(e) => {
                              const v = [...links];
                              v[i].link = e.target.value;
                              setLinks(v);
                              if (linksError) setLinksError('');
                            }}
                          />
                          {hasInvalidUrl ? (
                            <Text size="xs" c="red.6" mt={6}>
                              URL must start with http:// or https://
                            </Text>
                          ) : null}
                        </div>
                      )}
                      <div className={mp.editItemDeleteRow}>
                        <button
                          type="button"
                          className={mp.btnDelete}
                          onClick={() => setLinks(links.filter((_, j) => j !== i))}
                        >
                          Delete
                        </button>
                      </div>
                    </Paper>
                  );
                })}
                <button
                  type="button"
                  className={mp.btnAdd}
                  onClick={() => setLinks([...links, { name: '', link: '', phone: '' }])}
                >
                  <Image src="/plus.svg" alt="" width={18} height={18} />
                  Add link
                </button>
              </Stack>
            )}
            <div className={mp.linksGrid}>
              {(canEdit ? links.filter((l) => l.name.trim()) : viewLinks).map((row, idx) => {
                const name = row.name;
                const link = row.link;
                const icon = socialIconSrc(name);
                const isWa = isWhatsAppLinkName(name);
                let href = (link || '').trim();
                if (isWa) {
                  const digits = formatPhoneForWhatsApp(row.phone || link);
                  href = digits ? `https://wa.me/${digits}` : '';
                }
                if (!name?.trim() || !href) return null;
                return (
                  <a
                    key={`${name}-${idx}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={mp.linkBtn}
                  >
                    <Image src={icon} alt="" width={26} height={26} />
                    <span>{name}</span>
                  </a>
                );
              })}
            </div>
          </Paper>
        )}

        {/* Section 3 — Free Session */}
        {(embedUrl || canEdit) && (
          <Paper radius="xl" p="lg" className={`${mp.darkSection} ${mp.section} ${mp.youtubeSection}`}>
            <Title order={3} mb="md" className={mp.darkSectionTitle}>
              Free Session
            </Title>
            {canEdit && (
              <div className={`form-group ${mp.editForm} ${mp.editFormHero}`}>
                <label className="form-label">YouTube URL</label>
                <input
                  className="form-input"
                  value={ytLink}
                  onChange={(e) => setYtLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{marginBottom: '15px'}}
                />
              </div>
            )}
            {embedUrl && (
              <Box className="video-player-wrapper" style={{ borderRadius: 12, overflow: 'hidden' }}>
                <Box
                  style={{
                    position: 'relative',
                    paddingBottom: '56.25%',
                    height: 0,
                    overflow: 'hidden',
                    background: '#000',
                  }}
                >
                  <iframe
                    title="Free session video"
                    src={embedUrl}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {/* Section 4 — Centers */}
        {((scheduleRows.length > 0) || canEdit) && (
          <Paper radius="xl" p="lg" className={`${mp.darkSection} ${mp.section} ${mp.centersSection}`}>
            <Title order={3} mb="md" className={mp.darkSectionTitle}>
              Centers Schedule
            </Title>
            {canEdit && (
              <MarketingMultiSelect
                label="Centers on this page"
                options={options.centers || []}
                value={centerIds}
                onChange={setCenterIds}
                placeholder="Select centers…"
                onDark
              />
            )}
            {scheduleRows.length > 0 && (
              <ScrollArea h={360} type="auto" mt="md">
                <Table striped highlightOnHover withTableBorder className={mp.premiumTable}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Center</Table.Th>
                      <Table.Th>Course</Table.Th>
                      <Table.Th>Day</Table.Th>
                      <Table.Th>Time</Table.Th>
                      <Table.Th>Location</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {scheduleRows.map((r, i) => (
                      <Table.Tr key={`${r.center}-${i}`}>
                        <Table.Td>{r.center}</Table.Td>
                        <Table.Td>{r.course_display ?? r.course}</Table.Td>
                        <Table.Td>{r.day}</Table.Td>
                        <Table.Td>{r.time}</Table.Td>
                        <Table.Td>
                          <ScheduleLocationCell row={r} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Paper>
        )}

        {/* Section 5 — Contact Us */}
        {((contactAssistants.length > 0) || canEdit) && (
          <Paper radius="xl" p="lg" className={`${mp.darkSection} ${mp.section} ${mp.contactSection}`}>
            <Title order={3} mb="md" className={mp.darkSectionTitle}>
              Contact Us
            </Title>
            {canEdit && (
              <Box mb="md">
                <MarketingMultiSelect
                  label="Assistants / admins to contact with"
                  options={options.staff || []}
                  value={assistantIds}
                  onChange={setAssistantIds}
                  placeholder="Select people…"
                  onDark
                />
              </Box>
            )}
            {contactAssistants.length > 0 && (
              <ScrollArea h={320} type="auto">
                <Table striped highlightOnHover withTableBorder className={mp.premiumTable}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Phone No.</Table.Th>
                      <Table.Th>Send WhatsApp</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {contactAssistants.map((a) => {
                      const phoneNumber = formatPhoneForWhatsApp(a.phone);
                      const whatsappUrl = phoneNumber ? `https://wa.me/${phoneNumber}` : '';
                      return (
                        <Table.Tr key={a._id}>
                          <Table.Td style={{ fontWeight: 600 }}>
                            {a.name}
                          </Table.Td>
                          <Table.Td>{a.phone}</Table.Td>
                          <Table.Td>
                            <Button
                              component="a"
                              href={whatsappUrl || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              disabled={!whatsappUrl}
                              className={mp.whatsappBtn}
                              styles={{
                                root: {
                                  backgroundColor: '#43d55d',
                                  '&:hover': { backgroundColor: '#43d55d' },
                                },
                              }}
                              leftSection={<Image src="/whatsapp.svg" alt="" width={20} height={20} />}
                            >
                              Send
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Paper>
        )}

        {(data.note?.trim() || canEdit) && (
          <Paper
            radius="xl"
            p="lg"
            className={`${mp.darkSection} ${mp.noteSectionCard} ${mp.noteSection}`}
          >
            {canEdit ? (
              <Stack gap="sm" align="stretch" className={`${mp.editForm} ${mp.editFormHero} ${mp.noteSectionEdit}`}>
                <Title order={3} className={mp.darkSectionTitle}>
                  Note
                </Title>
                <div className="form-group">
                  <textarea
                    className={`form-input ${mp.noteInput}`}
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an important note for visitors…"
                  />
                </div>
              </Stack>
            ) : (
              <Stack gap="md" className={mp.noteSectionView}>
                <Title order={3} className={mp.darkSectionTitle}>
                  Note
                </Title>
                <p className={`${mp.noteText} ${lora.className}`}>{data.note}</p>
              </Stack>
            )}
          </Paper>
        )}

        {(data.outro_text?.trim() || canEdit) && (
          <Paper
            radius="xl"
            p="lg"
            className={`${mp.darkSection} ${mp.outroSectionCard} ${mp.outroSection}`}
          >
            {canEdit ? (
              <Stack gap="sm" className={`${mp.editForm} ${mp.editFormHero}`}>
                <Title order={3} className={mp.darkSectionTitle}>
                  Closing message
                </Title>
                <div className="form-group">
                  <textarea
                    className={`form-input ${mp.outroInput}`}
                    rows={3}
                    value={outroText}
                    onChange={(e) => setOutroText(e.target.value)}
                    placeholder="A short closing note for visitors…"
                  />
                </div>
              </Stack>
            ) : (
              <p className={`${mp.outroText} ${caveat.className}`}>{data.outro_text}</p>
            )}
          </Paper>
        )}

        {(canEdit || isAssistant) && (
          <div className={mp.copyLinkSection}>
            <div className={`${mp.copyLinkCard} ${mp.darkSection}`}>
              <div className={`${mp.copyLinkTitle} ${mp.darkSectionTitle}`}>
                <Image src="/link2.svg" alt="" width={20} height={20} />
                Marketing Page Link:
              </div>
              <div className={mp.copyLinkDisplay}>
                <strong>{marketingPageUrl}</strong>
              </div>
              <button type="button" className={mp.copyLinkBtn} onClick={copyMarketingPageLink}>
                <Image src="/copy2.svg" alt="" width={20} height={20} />
                Copy Link
              </button>
              {copyLinkSuccess ? (
                <div className={mp.copyLinkSuccess}>✅ {copyLinkSuccess}</div>
              ) : null}
            </div>
          </div>
        )}

        {canEdit && (
          <div className={mp.saveRow}>
            <button
              type="button"
              className={mp.btnSave}
              disabled={!hasFormChanges || saving}
              onClick={saveContent}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </Stack>

      {confirmHideOpen && (
        <div
          className="confirm-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmHideOpen(false);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, textAlign: 'center', color: '#1e293b' }}>
              Hide marketing page?
            </h3>
            <p className={mp.confirmText}>
              This page will be hidden from everyone. Anyone trying to access it will be redirected
              to a 404 page. Continue?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={confirmHidePage}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                Hide page
              </button>
              <button
                type="button"
                onClick={() => setConfirmHideOpen(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Box>
  );
}

