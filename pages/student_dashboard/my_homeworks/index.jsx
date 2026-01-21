import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import NeedHelp from '../../../components/NeedHelp';
import HomeworkPerformanceChart from '../../../components/HomeworkPerformanceChart';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

// Input with Button Component (matching manage online system style)
function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by lesson name..."
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled" onClick={props.onButtonClick}>
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}

// Custom Week Select for Student Dashboard (only shows available weeks)
function StudentWeekSelect({ availableWeeks = [], selectedWeek, onWeekChange, isOpen, onToggle, onClose, placeholder = 'Select Week' }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleWeekSelect = (week) => {
    onWeekChange(week);
    onClose();
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: isOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedWeek && selectedWeek !== 'n/a' ? '#000000' : '#adb5bd',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={onToggle}
      >
        <span>{selectedWeek && selectedWeek !== 'n/a' ? selectedWeek : placeholder}</span>
        <Image
          src={isOpen ? "/chevron-down.svg" : "/chevron-right.svg"}
          alt={isOpen ? "Close" : "Open"}
          width={20}
          height={20}
          style={{
            transition: 'transform 0.2s ease'
          }}
        />

      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '2px solid #e9ecef',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '4px'
        }}>
          {/* Clear selection option */}
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500'
            }}
            onClick={() => handleWeekSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {availableWeeks.map((week) => (
            <div
              key={week}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: '#000000'
              }}
              onClick={() => handleWeekSelect(week)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              {week}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyHomeworks() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [completedHomeworks, setCompletedHomeworks] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  
  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_homeworks', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch homeworks
  const { data: homeworksData, isLoading } = useQuery({
    queryKey: ['homeworks-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const homeworks = homeworksData?.homeworks || [];

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterWeekDropdownOpen, setFilterWeekDropdownOpen] = useState(false);

  // Extract week number from week string (e.g., "week 01" -> 1)
  const extractWeekNumber = (weekString) => {
    if (!weekString) return null;
    const match = weekString.match(/week\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  // Convert week number to week string (e.g., 1 -> "week 01")
  const weekNumberToString = (weekNumber) => {
    if (weekNumber === null || weekNumber === undefined) return '';
    return `week ${String(weekNumber).padStart(2, '0')}`;
  };

  // Get available weeks from homeworks (only weeks that exist in the data)
  const getAvailableWeeks = () => {
    const weekSet = new Set();
    homeworks.forEach(homework => {
      if (homework.week !== undefined && homework.week !== null) {
        weekSet.add(weekNumberToString(homework.week));
      }
    });
    return Array.from(weekSet).sort((a, b) => {
      const aNum = extractWeekNumber(a);
      const bNum = extractWeekNumber(b);
      return (aNum || 0) - (bNum || 0);
    });
  };

  const availableWeeks = getAvailableWeeks();

  // Filter homeworks based on search and filters
  const filteredHomeworks = homeworks.filter(homework => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = homework.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Week filter
    if (filterWeek) {
      const weekNumber = extractWeekNumber(filterWeek);
      if (homework.week !== weekNumber) {
        return false;
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      setSearchTerm("");
    }
  }, [searchInput, searchTerm]);

  // Handle search
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Fetch homework performance chart data - always fetch even if no homeworks
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['homework-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/homework-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching homework performance:', error);
        return { chartData: [] }; // Return empty array on error
      }
    },
    enabled: !!profile?.id,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1, // Retry once on failure
  });

  const chartData = performanceData?.chartData || [];

  // Refetch chart data when returning to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Invalidate and refetch chart data when route changes
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
    }

    // Listen for route changes
    router.events.on('routeChangeComplete', handleRouteChange);
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, queryClient, profile?.id, refetchChart]);

  // Check which homeworks have been completed
  useEffect(() => {
    if (!profile?.id || homeworks.length === 0) return;

    const checkCompletions = async () => {
      const completed = new Set();
      for (const homework of homeworks) {
        try {
          const response = await apiClient.get(`/api/students/${profile.id}/check-homework?homework_id=${homework._id}`);
          if (response.data.success && response.data.hasResult) {
            completed.add(homework._id);
          }
        } catch (err) {
          // Silently fail - just don't show Details button
        }
      }
      setCompletedHomeworks(completed);
    };

    checkCompletions();
  }, [profile?.id, homeworks]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/books.svg" alt="Books" width={32} height={32} />
              My Homeworks
            </div>
          </Title>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #f5c6cb',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {errorMessage}
            </div>
          )}
          
          {/* White Background Container */}
          <div className="homeworks-container" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(31, 168, 220, 0.2)",
              borderTop: "4px solid #1FA8DC",
              borderRadius: "50%",
              margin: "0 auto 20px",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading homeworks...</p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
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
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/books.svg" alt="Books" width={32} height={32} />
            My Homeworks
          </div>
        </Title>

        {/* Homework Performance Chart - Outside container, under Title */}
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 20px 0',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#212529'
          }}>
            Homework Performance by Week
          </h2>
          {isChartLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Loading chart data...
            </div>
          ) : (
            <HomeworkPerformanceChart chartData={chartData} height={400} />
          )}
        </div>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
        {homeworks.length > 0 && (
          <div className="filters-container" style={{
            background: 'white',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            marginBottom: 24,
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div className="filter-row" style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
                <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                  Filter by Week
                </label>
                <StudentWeekSelect
                  availableWeeks={availableWeeks}
                  selectedWeek={filterWeek}
                  onWeekChange={(week) => {
                    setFilterWeek(week);
                  }}
                  isOpen={filterWeekDropdownOpen}
                  onToggle={() => {
                    setFilterWeekDropdownOpen(!filterWeekDropdownOpen);
                  }}
                  onClose={() => setFilterWeekDropdownOpen(false)}
                  placeholder="Select Week"
                />
              </div>
            </div>
          </div>
        )}

        {/* White Background Container */}
        <div className="homeworks-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Homeworks List */}
          {filteredHomeworks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {homeworks.length === 0 ? '❌ No homeworks available.' : 'No homeworks match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredHomeworks.map((homework) => (
                <div
                  key={homework._id}
                  className="homework-item"
                  style={{
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1FA8DC';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>
                      {[homework.week !== undefined && homework.week !== null ? `Week ${homework.week}` : null, homework.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{homework.questions?.length || 0} Question{homework.questions?.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                        {homework.timer ? `Timer ${homework.timer} minute${homework.timer !== 1 ? 's' : ''}` : 'No Timer'}
                      </span>
                    </div>
                  </div>
                  <div className="homework-buttons" style={{ display: 'flex', gap: '12px' }}>
                    {completedHomeworks.has(homework._id) ? (
                      <>
                        <button
                          onClick={() => router.push(`/student_dashboard/my_homeworks/details?id=${homework._id}`)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#0d5a7a';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#1FA8DC';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <Image src="/details.svg" alt="Details" width={18} height={18} />
                          Details
                        </button>
                        <button
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'default',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          ✅ Done
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => router.push(`/student_dashboard/my_homeworks/start?id=${homework._id}`)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#218838';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#28a745';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        <Image src="/play.svg" alt="Play" width={16} height={16} />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            margin: 20px auto;
            padding: 8px;
          }
          .homeworks-container {
            padding: 16px;
          }
          .homework-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .homework-buttons {
            width: 100%;
          }
          .homework-buttons button {
            width: 100%;
            justify-content: center;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
            padding: 5px;
          }
          .homeworks-container {
            padding: 12px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 12px !important;
          }
        }
        @media (max-width: 360px) {
          .homeworks-container {
            padding: 10px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 10px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
          }
        }
      `}</style>
    </div>
  );
}
